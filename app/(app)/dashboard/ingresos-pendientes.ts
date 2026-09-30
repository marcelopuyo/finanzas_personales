// Agrupación de los **ítems pendientes** de cobro para el Detalle de Ingresos.
//
// 🔑 **Por qué existe** (pedido del usuario, 2026-09-30): con el criterio
// DEVENGADO (§190) la dona y el badge del mes ya cuentan las jornadas cargadas
// que todavía no se cobraron, pero el **Detalle** listaba sólo **liquidaciones**
// ⇒ un cobro existe recién cuando se cobra, así que las últimas jornadas
// **no aparecían en ninguna fila**. Acá se arman los grupos que el Detalle pinta
// como filas "Sin cobrar" (monto en rojo): un grupo por trabajo.
//
// Módulo **puro** (sin React ni BD) para poder validarlo compilándolo.

import type { ItemPendienteOut } from "@/backend/src/queries/trabajos";
import { SIN_TRABAJO, ymd } from "@/backend/src/lib/ingresos-trabajo";

/** Un trabajo con ítems sin liquidar: una fila del Detalle de Ingresos. */
export interface GrupoPendienteIngresos {
  /** Clave estable de la fila (`pendiente:<id|nombre>`). */
  key: string;
  /** Nombre del trabajo (`SIN_TRABAJO` si no se pudo resolver). */
  trabajo: string;
  /** "YYYY-MM-DD" del ítem más viejo y del más nuevo del grupo. */
  fechaDesde: string;
  fechaHasta: string;
  /** Σ de los ítems **sin** propina: la propina va aparte, como en las liquidaciones. */
  monto: number;
  /** Σ de la propina de las jornadas del grupo (devengo de su jornada). */
  propina: number;
  jornadas: number;
  tareas: number;
}

/**
 * Agrupa los ítems pendientes por trabajo y devuelve **un grupo por trabajo**,
 * ordenado por la fecha de su ítem más reciente (DESC), igual que el resto del
 * módulo de ingresos.
 */
export function agruparPendientes(
  items: ItemPendienteOut[]
): GrupoPendienteIngresos[] {
  const porTrabajo = new Map<string, GrupoPendienteIngresos>();

  items.forEach((i) => {
    const trabajo = i.trabajoNombre ?? SIN_TRABAJO;
    const key = `pendiente:${i.trabajoId ?? trabajo}`;
    const fecha = ymd(i.fecha);
    const grupo = porTrabajo.get(key);
    if (!grupo) {
      porTrabajo.set(key, {
        key,
        trabajo,
        fechaDesde: fecha,
        fechaHasta: fecha,
        monto: i.monto ?? 0,
        propina: i.montoPropina ?? 0,
        jornadas: i.tipo === "jornada" ? 1 : 0,
        tareas: i.tipo === "tarea" ? 1 : 0,
      });
      return;
    }
    if (fecha < grupo.fechaDesde) grupo.fechaDesde = fecha;
    if (fecha > grupo.fechaHasta) grupo.fechaHasta = fecha;
    grupo.monto += i.monto ?? 0;
    grupo.propina += i.montoPropina ?? 0;
    if (i.tipo === "jornada") grupo.jornadas += 1;
    else grupo.tareas += 1;
  });

  return [...porTrabajo.values()].sort((a, b) =>
    b.fechaHasta.localeCompare(a.fechaHasta)
  );
}
