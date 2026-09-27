// Adaptador del panel de INGRESOS: traduce los datos del backend
// (`LiquidacionOut` + propinas depositadas) a las estructuras del **criterio
// único** de `backend/src/lib/ingresos-trabajo.ts` y expone los 3 lectores que
// usa el dashboard (badge del mes, ingresos por trabajo, evolución).
//
// ⚠️ Acá NO hay reglas de negocio: todas viven en el módulo puro (P1.a). Este
// archivo sólo mapea y da formato (lo comparten el SSR y el cliente).
import {
  aportesEnRango,
  aportesPorMes,
  ingresosDelMes,
  tieneCobroReal,
  ymd,
  SIN_TRABAJO,
  type FuenteIngresos,
  type LiquidacionIngreso,
  type PropinaIngreso,
} from "@/backend/src/lib/ingresos-trabajo";
import type {
  LiquidacionOut,
  PropinaDepositadaOut,
} from "@/backend/src/queries/trabajos";

/**
 * Normaliza los datos del backend a la fuente del cálculo. Los `LiquidacionOut`
 * ya vienen con sus ítems sin los eliminados (`queries/trabajos.ts`).
 */
export function aFuenteIngresos(
  liquidaciones: LiquidacionOut[],
  propinas: PropinaDepositadaOut[]
): FuenteIngresos {
  const liqs: LiquidacionIngreso[] = liquidaciones.map((p) => ({
    trabajo: p.trabajo?.nombre ?? SIN_TRABAJO,
    fechaDesde: ymd(p.fechaDesde),
    fechaHasta: ymd(p.fechaHasta),
    // La fecha de cobro la necesita el criterio para el cobro ADELANTADO.
    fechaDeCobro: ymd(p.fechaDeCobro),
    modalidad: p.trabajo?.modalidadCobro ?? "horas_variables",
    cobrada: tieneCobroReal(p.fechaDeCobro),
    // Prorrateo sobre lo COBRADO (P1.a.1), con fallback histórico al calculado.
    montoCobrado: p.montoCobrado ?? p.montoCalculado ?? 0,
    items: [
      ...p.jornadas.map((j) => ({
        fecha: ymd(j.fechaJornada),
        monto: j.montoJornada || 0,
      })),
      ...p.tareas.map((t) => ({
        fecha: ymd(t.fechaTarea),
        monto: t.montoTarea || 0,
      })),
    ],
  }));
  const props: PropinaIngreso[] = propinas.map((p) => ({
    fecha: p.fecha,
    monto: p.monto,
    trabajo: p.trabajo || SIN_TRABAJO,
  }));
  return { liquidaciones: liqs, propinas: props };
}

/**
 * Ingresos de la ventana [desde, hasta] (fechas inclusive, "YYYY-MM-DD"; sin
 * fechas = todo). Devuelve el total y el detalle por trabajo.
 */
export function ingresosEnRango(
  fuente: FuenteIngresos,
  desde?: string,
  hasta?: string
): { total: number; porTrabajo: Map<string, number> } {
  return aportesEnRango(fuente, desde, hasta);
}

/**
 * Total del **mes calendario** de `hoyISO` (badge "Mes actual"): mes completo,
 * sin el corte "a la fecha" que tenía el prorrateo viejo (P1.a.1).
 */
export function ingresosDelMesActual(
  fuente: FuenteIngresos,
  hoyISO: string
): number {
  return ingresosDelMes(fuente, hoyISO);
}

/**
 * Evolución de ingresos por mes: una entrada por mes con datos, ordenada
 * cronológicamente y con **la misma etiqueta que Gastos** (`sep-2026`), porque
 * `getEvolucionResultados` resta las dos series por etiqueta.
 */
export function evolucionIngresosPorMes(
  fuente: FuenteIngresos
): { name: string; value: number }[] {
  return [...aportesPorMes(fuente).entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([ym, value]) => {
      const [y, m] = ym.split("-").map(Number);
      const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(
        "es-ES",
        { month: "short", timeZone: "UTC" }
      );
      return { name: `${label}-${y}`, value };
    });
}
