// **Criterio ÚNICO de ingresos de trabajo** (decisión P1.a de
// `DeepSeek/plan-liquidaciones.md`). Módulo **puro** (sin React ni BD): lo usan
// el panel del dashboard (`app/(app)/dashboard/ingresos-helpers.ts`) y la query
// del gráfico de evolución (`backend/src/queries/reportes.ts`) para que los **3
// lectores** (badge del mes, ingresos por trabajo, evolución) no se
// desincronicen nunca (P1.d).
//
// Reglas (una sola rama por liquidación):
//  1. **Propina = ingreso REAL**, imputado a la **fecha de su MOVIMIENTO** de
//     depósito ("Cobro Propina"), sin esperar la liquidación (P1.a.3).
//  2. **Liquidación con ítems** (jornadas/tareas — incluye las legacy que
//     tienen hijos): el ingreso son los **ítems**, cada uno por la **fecha del
//     ítem** (devengo) y **completo** aunque el cobro haya sido parcial
//     (P1.a.2 / P1.a.6).
//  3. **Liquidación `fijo`/`horas_fijas` sin ítems**: si se cobró **antes de que
//     terminara el rango** (cobro ADELANTADO) el dinero entró ese día ⇒ el
//     **monto completo** se reconoce en el **mes de la fecha de cobro**; si no,
//     **prorrateo del rango por días** sobre el `montoCobrado` (sin el corte
//     "hasta hoy" del mes en curso).
//  4. **Sin cobrar no hay ingreso**: una liquidación sin `fechaDeCobro` no
//     aporta (el panel muestra lo cobrado; lo pendiente va a "Por cobrar").

export const SIN_TRABAJO = "Sin trabajo";

/** Meses que reconoce una modalidad sin ítems al prorratear. */
export function esModalidadFija(modalidad: string): boolean {
  return modalidad === "fijo" || modalidad === "horas_fijas";
}

/**
 * ¿El cobro fue **ADELANTADO**? Sí: se cobró **antes de que terminara el rango**
 * (`fechaDeCobro < fechaHasta`).
 *
 * Decisión del usuario (2026-09-26, restaura la regla del §8 de
 * `plan-remodelacion-trabajo.md`): en un cobro adelantado el dinero **entró ese
 * día**, así que el monto completo se reconoce en el **mes de la fecha de cobro**
 * y **no** se prorratea. Alcance: sólo `fijo`/`horas_fijas` (las modalidades con
 * ítems se rigen por la fecha de cada ítem).
 */
export function cobroAdelantado(l: LiquidacionIngreso): boolean {
  return !!l.fechaDeCobro && !!l.fechaHasta && l.fechaDeCobro < l.fechaHasta;
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
  /** "YYYY-MM-DD" del rango de la liquidación. */
  fechaDesde: string;
  fechaHasta: string;
  /** "YYYY-MM-DD" de la fecha de cobro ("" si no se cobró). */
  fechaDeCobro: string;
  /** Modalidad del trabajo (`fijo`/`horas_fijas` prorratean; el resto no). */
  modalidad: string;
  /** `true` si tiene `fechaDeCobro` real (centinela < 1901 = no cobrada). */
  cobrada: boolean;
  /** Monto realmente cobrado (nominal), con fallback al calculado. */
  montoCobrado: number;
  /** Ítems devengados (jornadas y/o tareas), ya sin los eliminados. */
  items: ItemIngreso[];
}

/** Depósito de propina real (movimiento "Cobro Propina"). */
export interface PropinaIngreso {
  /** "YYYY-MM-DD" del MOVIMIENTO (no de la jornada). */
  fecha: string;
  monto: number;
  trabajo: string;
}

/** Fuente completa del panel de ingresos. */
export interface FuenteIngresos {
  liquidaciones: LiquidacionIngreso[];
  propinas: PropinaIngreso[];
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
    const [y, m] = cursor.split("-").map(Number);
    const d = new Date(Date.UTC(y, m, 1));
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

  // 1) Propinas depositadas: ingreso real por la fecha de su movimiento.
  for (const p of fuente.propinas) {
    if (enVentana(p.fecha)) add(p.trabajo || SIN_TRABAJO, p.monto);
  }

  // 2) Liquidaciones COBRADAS (las no cobradas no aportan ingreso).
  for (const l of fuente.liquidaciones) {
    if (!l.cobrada) continue;
    if (l.items.length > 0) {
      for (const it of l.items) {
        if (enVentana(it.fecha)) add(l.trabajo, it.monto);
      }
      continue;
    }
    if (esModalidadFija(l.modalidad)) {
      // Cobro ADELANTADO: el dinero entró el día del cobro ⇒ el monto completo
      // se reconoce en su mes (no se prorratea).
      if (cobroAdelantado(l)) {
        if (enVentana(l.fechaDeCobro)) add(l.trabajo, l.montoCobrado);
        continue;
      }
      add(
        l.trabajo,
        prorrateoPorDias(l.fechaDesde, l.fechaHasta, l.montoCobrado, desde, hasta)
      );
    }
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
    if (!l.cobrada) continue;
    // Un cobro adelantado se reconocerá en el mes de SU fecha de cobro (que
    // puede estar fuera del rango, ej.: rango de octubre cobrado en septiembre).
    if (esModalidadFija(l.modalidad) && cobroAdelantado(l)) {
      meses.add(ymDe(l.fechaDeCobro));
    } else {
      for (const m of mesesDelRango(l.fechaDesde || l.fechaHasta, l.fechaHasta)) {
        meses.add(m);
      }
    }
    for (const it of l.items) if (it.fecha) meses.add(ymDe(it.fecha));
  }
  for (const p of fuente.propinas) if (p.fecha) meses.add(ymDe(p.fecha));

  const out = new Map<string, number>();
  for (const ym of [...meses].sort()) {
    const { total } = aportesEnRango(fuente, `${ym}-01`, finDeMesISO(ym));
    if (total > 0.005) out.set(ym, total);
  }
  return out;
}
