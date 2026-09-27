// Adaptador del panel de INGRESOS: expone los 3 lectores que usa el dashboard
// (badge del mes, ingresos por trabajo, evolución) sobre el **criterio único
// DEVENGADO** de `backend/src/lib/ingresos-trabajo.ts`.
//
// ⚠️ Acá NO hay reglas de negocio (ni mapeo de datos): todo eso vive en el
// módulo puro, que es el único lugar donde se define el criterio. Este archivo
// sólo da formato a lo que devuelve (lo comparten el SSR y el cliente).
import {
  aportesEnRango,
  aportesPorMes,
  ingresosDelMes,
  type FuenteIngresos,
} from "@/backend/src/lib/ingresos-trabajo";

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
