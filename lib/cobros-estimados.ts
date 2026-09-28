// **Inferencia de la cadencia de liquidación por trabajo** (plan
// `DeepSeek/plan-cobros-estimados.md`, aprobado 2026-09-27). Módulo **puro** (sin
// React ni BD): lo usa el panel del dashboard para repartir los ítems pendientes
// en **tandas estimadas** y separar lo que **ya se puede cobrar** de lo que no.
//
// Reglas (medidas sobre los datos reales de PROD):
//  1. **`duracion`** = moda de los días de cada período (últimas `N_HISTORIAL`
//     liquidaciones cerradas; en empate gana la más reciente). Duffys: 14 ·
//     Atlas: 10.
//  2. **`paso`** = mediana de los días entre INICIOS consecutivos (con
//     `TOLERANCIA_PASO` de jitter: arrancar el período un día antes/después no
//     cambia la cadencia). Duffys: 14 (sábado→viernes consecutivos) · Atlas: 14
//     (quincenal, con ventanas de ~10 días y huecos).
//  3. **`ancla`** = `fechaDesde` de la última liquidación cerrada.
//  4. **Ventanas**: `inicio(k) = ancla + k · paso`, `fin = inicio + duracion − 1`,
//     generadas hacia adelante y hacia atrás hasta cubrir los ítems pendientes.
//  5. **"Por cobrar"** = los ítems cuya ventana **YA CERRÓ** (`fin ≤ hoy`)
//     (decisión del usuario). Lo demás (en curso, futura) va a **"En curso"**.
//  6. Ítems que no caen en ninguna ventana ⇒ **"Sin período estimado"**.
//  7. **Sin cadencia confiable** (menos de 3 liquidaciones, duración 1 día —
//     típico de `por_tarea` y de los trabajos legacy— o paso inconsistente) ⇒
//     `cadencia = null`: el trabajo se muestra **sin separar**, como antes.
//     ⛔ Nunca inventar un estimado con 1–2 datos.

/** Cuántas liquidaciones cerradas se miran para inferir la cadencia. */
export const N_HISTORIAL = 8;

/** Jitter tolerado (días) en el paso entre inicios para considerar la cadencia
 *  consistente. Medido: Atlas arranca cada 13–16 días (siempre ~14). */
export const TOLERANCIA_PASO = 2;

/** Ventana mínima de consistencia: % de diferencias dentro de la tolerancia. */
const MIN_CONSISTENCIA = 0.5;

/** Duración máxima de una ventana (guarda contra datos raros). */
const MAX_DURACION = 60;

/** Ventanas máximas a generar por trabajo (guarda). */
const MAX_VENTANAS = 80;

// ---------------------------------------------------------------------------
// Tipos de entrada (estructurales: los cumplen los DTO y las entidades)
// ---------------------------------------------------------------------------

/** Ítem pendiente de liquidar (basta con estos campos de `ItemPendienteOut`). */
export interface ItemPendienteFuente {
  trabajoNombre?: string | null;
  tipo: "jornada" | "tarea";
  fecha: string | Date;
  monto?: number | null;
  /** Propina de la jornada (no forma parte del monto de la liquidación). */
  montoPropina?: number | null;
  eliminado?: boolean;
}

/** Liquidación cerrada (basta con estos campos de `LiquidacionOut`). */
export interface LiquidacionCerradaFuente {
  trabajo?: { nombre: string } | null;
  fechaDesde: string | Date;
  fechaHasta: string | Date;
}

// ---------------------------------------------------------------------------
// Tipos de salida
// ---------------------------------------------------------------------------

/** Cadencia inferida de un trabajo. */
export interface CadenciaTrabajo {
  /** Días que dura el período (moda). */
  duracion: number;
  /** Días entre el inicio de un período y el del siguiente (mediana). */
  paso: number;
  /** `fechaDesde` de la última liquidación cerrada ("YYYY-MM-DD"). */
  ancla: string;
}

/** Agregado de los ítems de un trabajo que caen en una misma sección. */
export interface BloqueCobro {
  trabajo: string;
  /** Fecha del ítem más viejo / más nuevo del bloque ("YYYY-MM-DD"). */
  desde: string;
  hasta: string;
  /** Fin de la ventana estimada que los agrupa ("" si no hay cadencia). */
  cierre: string;
  jornadas: number;
  tareas: number;
  /** Σ de los montos de los ítems (sin propina). */
  monto: number;
  /** Σ de las propinas (informativo, no entra en `monto`). */
  propina: number;
}

/** Resultado por trabajo: como máximo un bloque por sección. */
export interface EstimacionTrabajo {
  trabajo: string;
  /** `null` = no se pudo inferir (se muestra sin separar). */
  cadencia: CadenciaTrabajo | null;
  /** Ventana ya cerrada (cobrable ahora). */
  porCobrar: BloqueCobro | null;
  /** Ventana en curso o futura (todavía no). */
  enCurso: BloqueCobro | null;
  /** Ítems fuera de toda ventana + trabajos sin cadencia. */
  sinPeriodo: BloqueCobro | null;
}

// ---------------------------------------------------------------------------
// Utilidades de fecha (siempre en UTC: las fechas son días, no instantes)
// ---------------------------------------------------------------------------

/** "YYYY-MM-DD" de un `Date` o string de fecha. */
function ymd(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/** Días entre dos "YYYY-MM-DD" (b − a). */
function diasEntre(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000
  );
}

/** "YYYY-MM-DD" desplazado `n` días. */
function sumarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Mediana de una lista de números (`null` si está vacía). */
function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const ord = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ord.length / 2);
  return ord.length % 2 ? ord[medio] : Math.round((ord[medio - 1] + ord[medio]) / 2);
}

/** Valor más frecuente; **en empate gana el más reciente** (`null` si vacía). */
function moda(valores: number[]): number | null {
  if (!valores.length) return null;
  const cuenta = new Map<number, number>();
  for (const v of valores) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  let mejor: number | null = null;
  let mejorN = 0;
  // Recorrido inverso con `>` estricto: el primero que alcanza el máximo (el más
  // reciente) gana los empates.
  for (let i = valores.length - 1; i >= 0; i--) {
    const n = cuenta.get(valores[i]) ?? 0;
    if (n > mejorN) {
      mejor = valores[i];
      mejorN = n;
    }
  }
  return mejor;
}

// ---------------------------------------------------------------------------
// Inferencia
// ---------------------------------------------------------------------------

/**
 * Infiere la cadencia de un trabajo a partir de sus liquidaciones **cerradas**
 * (todas las que se le pasen; el módulo se queda con las últimas `N_HISTORIAL`).
 * Devuelve `null` cuando no hay historia suficiente o la cadencia no es
 * consistente (ver regla 7 del encabezado).
 */
export function inferirCadencia(
  liquidaciones: LiquidacionCerradaFuente[]
): CadenciaTrabajo | null {
  const usables = liquidaciones
    .map((l) => ({ d: ymd(l.fechaDesde), h: ymd(l.fechaHasta) }))
    .filter((x) => x.d && x.h && x.d <= x.h)
    .sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  if (usables.length < 3) return null;

  const ult = usables.slice(-N_HISTORIAL);
  const duracion = moda(ult.map((x) => diasEntre(x.d, x.h) + 1));
  if (!duracion || duracion < 2 || duracion > MAX_DURACION) return null;

  const diffs: number[] = [];
  for (let i = 1; i < ult.length; i++) {
    const d = diasEntre(ult[i - 1].d, ult[i].d);
    if (d > 0) diffs.push(d);
  }
  // Sin diferencias usables (p. ej. todas el mismo día) ⇒ cadencia = duración
  // (períodos contiguos), que es lo que hace Duffys.
  const base = mediana(diffs) ?? duracion;
  if (diffs.length) {
    const dentro = diffs.filter((d) => Math.abs(d - base) <= TOLERANCIA_PASO).length;
    if (dentro / diffs.length < MIN_CONSISTENCIA) return null;
  }
  return {
    duracion,
    // El paso nunca puede ser menor que la duración (las ventanas se pisarían).
    paso: Math.max(base, duracion),
    ancla: ult[ult.length - 1].d,
  };
}

/** Una ventana estimada: `[desde, hasta]` + el mismo `hasta` como `cierre`. */
interface Ventana {
  desde: string;
  hasta: string;
}

/**
 * Ventanas que cubren el rango `[minISO, maxISO]` (se generan hacia adelante y
 * hacia atrás desde el ancla, para que un ítem viejo —de un período que nunca se
 * liquidó— caiga en SU ventana y no en el cajón de "sin período").
 */
export function ventanasDe(
  cad: CadenciaTrabajo,
  minISO: string,
  maxISO: string
): Ventana[] {
  const out: Ventana[] = [];
  const win = (desde: string): Ventana => ({
    desde,
    hasta: sumarDias(desde, cad.duracion - 1),
  });

  let inicio = cad.ancla;
  while (inicio <= maxISO && out.length < MAX_VENTANAS) {
    out.push(win(inicio));
    inicio = sumarDias(inicio, cad.paso);
  }
  inicio = sumarDias(cad.ancla, -cad.paso);
  while (inicio > minISO && out.length < MAX_VENTANAS) {
    out.unshift(win(inicio));
    inicio = sumarDias(inicio, -cad.paso);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reparto de los pendientes
// ---------------------------------------------------------------------------

function bloque(
  trabajo: string,
  items: ItemPendienteFuente[],
  cierre: string
): BloqueCobro {
  const fechas = items.map((i) => ymd(i.fecha)).sort();
  return {
    trabajo,
    desde: fechas[0] ?? "",
    hasta: fechas[fechas.length - 1] ?? "",
    cierre,
    jornadas: items.filter((i) => i.tipo === "jornada").length,
    tareas: items.filter((i) => i.tipo === "tarea").length,
    monto: Number(
      items.reduce((acc, i) => acc + (i.monto ?? 0), 0).toFixed(2)
    ),
    propina: Number(
      items.reduce((acc, i) => acc + (i.montoPropina ?? 0), 0).toFixed(2)
    ),
  };
}

/**
 * Reparte los ítems pendientes de cada trabajo en las tres secciones del panel:
 * **por cobrar** (ventana cerrada) · **en curso** (ventana abierta/futura) ·
 * **sin período estimado** (sin cadencia o fuera de toda ventana).
 */
export function estimarCobros(
  items: ItemPendienteFuente[],
  liquidaciones: LiquidacionCerradaFuente[],
  hoyISO: string,
  trabajoSinAsignar = "Sin trabajo"
): EstimacionTrabajo[] {
  const pendientes = items.filter((i) => !i.eliminado);
  if (!pendientes.length) return [];

  // Ítems agrupados por trabajo (mismo criterio que el panel: `trabajoNombre`).
  const porTrabajo = new Map<string, ItemPendienteFuente[]>();
  for (const i of pendientes) {
    const nombre = i.trabajoNombre || trabajoSinAsignar;
    const lista = porTrabajo.get(nombre);
    if (lista) lista.push(i);
    else porTrabajo.set(nombre, [i]);
  }

  // Liquidaciones por trabajo (para inferir la cadencia de cada uno).
  const liqsPorTrabajo = new Map<string, LiquidacionCerradaFuente[]>();
  for (const l of liquidaciones) {
    const nombre = l.trabajo?.nombre || trabajoSinAsignar;
    const lista = liqsPorTrabajo.get(nombre);
    if (lista) lista.push(l);
    else liqsPorTrabajo.set(nombre, [l]);
  }

  const out: EstimacionTrabajo[] = [];
  for (const [trabajo, lista] of porTrabajo.entries()) {
    const cadencia = inferirCadencia(liqsPorTrabajo.get(trabajo) ?? []);
    if (!cadencia) {
      out.push({
        trabajo,
        cadencia: null,
        porCobrar: null,
        enCurso: null,
        sinPeriodo: bloque(trabajo, lista, ""),
      });
      continue;
    }

    const fechas = lista.map((i) => ymd(i.fecha)).sort();
    const ventanas = ventanasDe(cadencia, fechas[0], fechas[fechas.length - 1]);

    const cerradas: ItemPendienteFuente[] = [];
    const abiertas: ItemPendienteFuente[] = [];
    const sueltos: ItemPendienteFuente[] = [];
    let cierreCerradas = "";
    let cierreAbiertas = "";
    for (const i of lista) {
      const f = ymd(i.fecha);
      const v = ventanas.find((w) => f >= w.desde && f <= w.hasta);
      if (!v) {
        sueltos.push(i);
        continue;
      }
      // "Por cobrar" = la ventana YA CERRÓ (decisión del usuario 2026-09-27).
      if (v.hasta <= hoyISO) {
        cerradas.push(i);
        if (v.hasta > cierreCerradas) cierreCerradas = v.hasta;
      } else {
        abiertas.push(i);
        if (v.hasta > cierreAbiertas) cierreAbiertas = v.hasta;
      }
    }

    out.push({
      trabajo,
      cadencia,
      porCobrar: cerradas.length ? bloque(trabajo, cerradas, cierreCerradas) : null,
      enCurso: abiertas.length ? bloque(trabajo, abiertas, cierreAbiertas) : null,
      sinPeriodo: sueltos.length ? bloque(trabajo, sueltos, "") : null,
    });
  }

  // Más reciente primero dentro de cada sección (mismo criterio que antes).
  return out.sort((a, b) => {
    const fa = a.enCurso?.hasta ?? a.porCobrar?.hasta ?? a.sinPeriodo?.hasta ?? "";
    const fb = b.enCurso?.hasta ?? b.porCobrar?.hasta ?? b.sinPeriodo?.hasta ?? "";
    return fa < fb ? 1 : fa > fb ? -1 : 0;
  });
}
