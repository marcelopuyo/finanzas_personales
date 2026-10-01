// **Criterio ÚNICO de ingresos de trabajo — criterio DEVENGADO** (decisión del
// usuario, 2026-09-27; **reemplaza el criterio de CAJA** de P1.a de
// `DeepSeek/plan-liquidaciones.md`). Módulo **puro** (sin React ni BD): lo usan
// el panel del dashboard (`app/(app)/dashboard/ingresos-helpers.ts`) y la query
// del gráfico de evolución (`backend/src/queries/reportes.ts`) para que los **3
// lectores** (badge del mes, ingresos por trabajo, evolución) no se
// desincronicen nunca (P1.d).
//
// 🔑 **Qué cambió**: antes el ingreso era **lo COBRADO** (sólo los ítems de las
// liquidaciones ya pagadas) ⇒ el mes en curso se veía incompleto hasta cobrar.
// Ahora el ingreso es **lo DEVENGADO**: lo que se trabajó y ganó en el período,
// se haya cobrado o no (lo que falta cobrar sigue viéndose, además, en la
// tarjeta "Por cobrar").
//
// Reglas (una sola rama por liquidación):
//  1. **Ítems (jornadas/tareas) = devengo por la FECHA DEL ÍTEM**, estén o no
//     liquidados/cobrados: un ítem pendiente de cobro ya es ingreso de su mes.
//  2. **Propina = parte del devengo de su jornada**: aporta en la **fecha de la
//     jornada** (no en la del movimiento de depósito) y **aunque todavía no se
//     haya depositado** en ninguna cuenta.
//  3. **Liquidación `fijo`/`horas_fijas` (sin ítems)**: no hay ítem que devengar
//     ⇒ **prorrateo del rango por días** sobre su monto. ⛔ Se retiró la regla de
//     **cobro adelantado** del §173: era de *caja* (imputaba todo al mes del
//     cobro) y contradice el devengo.
//  4. **Anular = dejar de devengar**: una liquidación anulada no aporta, pero sus
//     ítems —que vuelven a quedar pendientes— siguen contando por la regla 1.

export const SIN_TRABAJO = "Sin trabajo";

/** Meses que reconoce una modalidad sin ítems al prorratear. */
export function esModalidadFija(modalidad: string): boolean {
  return modalidad === "fijo" || modalidad === "horas_fijas";
}

/**
 * ¿La fila tiene un cobro **real**? Las `fechaDeCobro` centinela (anteriores a
 * 1901, que usaba el modelo viejo para "sin cobrar") no cuentan. Vive acá —y no
 * en la capa de queries— para que la puedan usar también los **componentes de
 * cliente** sin arrastrar `next/headers`.
 */
export function tieneCobroReal(
  fechaDeCobro: Date | string | null | undefined
): boolean {
  if (!fechaDeCobro) return false;
  return new Date(fechaDeCobro).getFullYear() >= 1901;
}

/** Un ítem devengado (jornada o tarea) con su fecha local y su monto. */
export interface ItemIngreso {
  /** "YYYY-MM-DD" (fecha local del ítem: `fechaJornada` / `fechaTarea`). */
  fecha: string;
  monto: number;
}

/** Liquidación ya normalizada para el cálculo (adaptada por cada caller). */
export interface LiquidacionIngreso {
  /** Nombre del trabajo (agrupa el panel y el gráfico). */
  trabajo: string;
  /** "YYYY-MM-DD" del rango de la liquidación (sólo prorratean `fijo`/`horas_fijas`). */
  fechaDesde: string;
  fechaHasta: string;
  /** Modalidad del trabajo (`fijo`/`horas_fijas` prorratean; el resto no). */
  modalidad: string;
  /** Monto de la liquidación (nominal cobrado, con fallback al calculado). */
  monto: number;
  /** Ítems devengados (jornadas y/o tareas), ya sin los eliminados. */
  items: ItemIngreso[];
}

/** Ítem devengado que **todavía no pertenece a ninguna liquidación**. */
export interface ItemPendienteIngreso extends ItemIngreso {
  /** Nombre del trabajo (agrupa el panel y el gráfico). */
  trabajo: string;
}

/** Fuente completa del panel de ingresos. */
export interface FuenteIngresos {
  liquidaciones: LiquidacionIngreso[];
  itemsPendientes: ItemPendienteIngreso[];
}

// ---------------------------------------------------------------------------
// Adaptador: entidades/DTOs → FuenteIngresos
// ---------------------------------------------------------------------------
// Los tipos de abajo son **estructurales** (no importan entidades ni queries) a
// propósito: los cumplen tanto los DTO del panel (`LiquidacionOut`,
// `ItemPendienteOut`) como las **entidades** que carga `queries/reportes.ts`.

interface JornadaFuente {
  fechaJornada: string | Date;
  montoJornada?: number | null;
  /** Propina de la jornada (misma fecha de devengo). */
  montoPropina?: number | null;
  eliminado?: boolean;
}

interface TareaFuente {
  fechaTarea: string | Date;
  montoTarea?: number | null;
  eliminado?: boolean;
}

/** Forma mínima de una liquidación (entidad o DTO). */
export interface LiquidacionFuente {
  fechaDesde: string | Date;
  fechaHasta: string | Date;
  montoCobrado?: number | null;
  montoCalculado?: number | null;
  trabajo?: { nombre: string; modalidadCobro: string } | null;
  jornadas?: JornadaFuente[] | null;
  tareas?: TareaFuente[] | null;
}

/** Forma mínima de un ítem pendiente de liquidar (`ItemPendienteOut`). */
export interface ItemPendienteFuente {
  trabajoNombre?: string | null;
  fecha: string | Date;
  monto?: number | null;
  montoPropina?: number | null;
}

/**
 * Normaliza las dos fuentes (liquidaciones con sus ítems + ítems pendientes) a
 * la estructura del cálculo.
 *
 * 🔑 La **propina de cada jornada se suma al monto de esa jornada**: se devenga
 * con ella (regla 2) y así deja de depender del movimiento de depósito.
 */
export function aFuenteIngresos(
  liquidaciones: LiquidacionFuente[],
  itemsPendientes: ItemPendienteFuente[] = []
): FuenteIngresos {
  return {
    liquidaciones: liquidaciones.map((l) => ({
      trabajo: l.trabajo?.nombre ?? SIN_TRABAJO,
      fechaDesde: ymd(l.fechaDesde),
      fechaHasta: ymd(l.fechaHasta),
      modalidad: l.trabajo?.modalidadCobro ?? "horas_variables",
      monto: l.montoCobrado ?? l.montoCalculado ?? 0,
      items: [
        ...(l.jornadas ?? [])
          .filter((j) => !j.eliminado)
          .map((j) => ({
            fecha: ymd(j.fechaJornada),
            monto: (j.montoJornada ?? 0) + (j.montoPropina ?? 0),
          })),
        ...(l.tareas ?? [])
          .filter((t) => !t.eliminado)
          .map((t) => ({
            fecha: ymd(t.fechaTarea),
            monto: t.montoTarea ?? 0,
          })),
      ],
    })),
    itemsPendientes: itemsPendientes.map((i) => ({
      trabajo: i.trabajoNombre ?? SIN_TRABAJO,
      fecha: ymd(i.fecha),
      monto: (i.monto ?? 0) + (i.montoPropina ?? 0),
    })),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" de un `Date` o string de fecha (sin corrimiento de zona). */
export function ymd(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/** "YYYY-MM" de una fecha "YYYY-MM-DD". */
export function ymDe(d: string): string {
  return d.slice(0, 7);
}

/** Último día del mes "YYYY-MM". */
export function finDeMesISO(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${pad(ultimo)}`;
}

/** Días entre dos "YYYY-MM-DD" (b − a). */
function diffDias(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000
  );
}

/**
 * Parte del monto del rango [desdeP, hastaP] que cae en [desde, hasta], **puro
 * por días** (días de la intersección ÷ días totales del rango). Sin fechas de
 * ventana = el rango completo.
 */
export function prorrateoPorDias(
  desdeP: string,
  hastaP: string,
  monto: number,
  desde?: string,
  hasta?: string
): number {
  if (!monto || monto <= 0 || !desdeP || !hastaP) return 0;
  const ini = desde && desde > desdeP ? desde : desdeP;
  const fin = hasta && hasta < hastaP ? hasta : hastaP;
  if (ini > fin) return 0;
  const totalDias = diffDias(desdeP, hastaP) + 1;
  if (totalDias <= 0) return 0;
  return (monto * (diffDias(ini, fin) + 1)) / totalDias;
}

/** Meses "YYYY-MM" que toca un rango (para prorratear mes por mes). */
export function mesesDelRango(desde: string, hasta: string): string[] {
  const out: string[] = [];
  let cursor = ymDe(desde);
  const fin = ymDe(hasta);
  while (cursor <= fin) {
    out.push(cursor);
    // ⚠️ `m` viene **1-based** del string ("2026-09" → 9) y el mes de `Date.UTC`
    // es **0-based** ⇒ hay que restarle 1 ANTES de construir la fecha. Sin el
    // `- 1` el cursor saltaba 2 meses por vuelta y `mesesDelRango` **salteaba el
    // mes siguiente** (bug del prorrateo de `fijo`/`horas_fijas` detectado en el
    // test sintético `.fp-devengo/`, 2026-10-01).
    const [y, m] = cursor.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1, 1));
    d.setUTCMonth(d.getUTCMonth() + 1);
    cursor = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
  }
  return out;
}

/**
 * Ingresos que caen en la ventana [desde, hasta] (fechas inclusive,
 * "YYYY-MM-DD"; sin fechas = todo): total + detalle por trabajo.
 */
export function aportesEnRango(
  fuente: FuenteIngresos,
  desde?: string,
  hasta?: string
): { total: number; porTrabajo: Map<string, number> } {
  const porTrabajo = new Map<string, number>();
  let total = 0;
  const add = (trabajo: string, monto: number) => {
    if (monto <= 0.005) return;
    total += monto;
    porTrabajo.set(trabajo, (porTrabajo.get(trabajo) ?? 0) + monto);
  };
  const enVentana = (f: string) =>
    (!desde || f >= desde) && (!hasta || f <= hasta) && !!f;

  // 1) Ítems de las liquidaciones (jornadas/tareas): devengo por su FECHA, con
  //    propina incluida (regla 1+2). No importa si la liquidación está cobrada.
  for (const l of fuente.liquidaciones) {
    if (l.items.length > 0) {
      for (const it of l.items) {
        if (enVentana(it.fecha)) add(l.trabajo, it.monto);
      }
      continue;
    }
    // 2) `fijo`/`horas_fijas` (sin ítems): prorrateo del rango por días (regla 3).
    if (esModalidadFija(l.modalidad)) {
      add(
        l.trabajo,
        prorrateoPorDias(l.fechaDesde, l.fechaHasta, l.monto, desde, hasta)
      );
    }
  }

  // 3) Ítems PENDIENTES de liquidar: ya son ingreso devengado (regla 1).
  for (const it of fuente.itemsPendientes) {
    if (enVentana(it.fecha)) add(it.trabajo, it.monto);
  }
  return { total, porTrabajo };
}

/**
 * Ingresos del **mes calendario** de `hoyISO` (completo: el mes en curso no se
 * corta a hoy — P1.a.1). Es el badge "Mes actual" y la base de "Resultados".
 */
export function ingresosDelMes(
  fuente: FuenteIngresos,
  hoyISO: string
): number {
  const ym = ymDe(hoyISO);
  return aportesEnRango(fuente, `${ym}-01`, finDeMesISO(ym)).total;
}

/**
 * Serie por mes "YYYY-MM" (para la evolución histórica): cada mes se calcula con
 * la MISMA función de rango ⇒ los meses cerrados y el mes en curso usan idéntico
 * criterio.
 */
export function aportesPorMes(fuente: FuenteIngresos): Map<string, number> {
  const meses = new Set<string>();
  for (const l of fuente.liquidaciones) {
    // Los meses que toca el RANGO sólo importan cuando la liquidación no tiene
    // ítems y hay que prorratearla (`fijo`/`horas_fijas`).
    if (l.items.length === 0 && esModalidadFija(l.modalidad) && l.fechaDesde) {
      for (const m of mesesDelRango(l.fechaDesde, l.fechaHasta)) {
        meses.add(m);
      }
    }
    for (const it of l.items) if (it.fecha) meses.add(ymDe(it.fecha));
  }
  for (const it of fuente.itemsPendientes) {
    if (it.fecha) meses.add(ymDe(it.fecha));
  }

  const out = new Map<string, number>();
  for (const ym of [...meses].sort()) {
    const { total } = aportesEnRango(fuente, `${ym}-01`, finDeMesISO(ym));
    if (total > 0.005) out.set(ym, total);
  }
  return out;
}
