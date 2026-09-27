// Selección de ítems pendientes del paso "Cobrar trabajo" (plan-liquidaciones.md,
// rebanada R2). Módulo **puro** (sin React ni BD): lo usan el paso del wizard, la
// confirmación y el precargado del stepper-context, para que el rango y el total
// "calculado" salgan de UN solo lugar y no se desincronicen.

import type { ItemPendienteOut } from "@/backend/src/queries/trabajos";

/**
 * Modalidades que **no** se liquidan por ítems: el usuario declara el rango (y las
 * horas en `horas_fijas`). Las demás (`horas_variables`, `por_tarea`) se liquidan
 * tildando jornadas/tareas pendientes.
 */
export function modalidadDeclarada(modalidad: string | undefined): boolean {
  return modalidad === "fijo" || modalidad === "horas_fijas";
}

/** Ítems pendientes que pertenecen a un trabajo. */
export function itemsDelTrabajo(
  items: ItemPendienteOut[],
  trabajoId: number
): ItemPendienteOut[] {
  return trabajoId
    ? items.filter((i) => i.trabajoId === trabajoId)
    : [];
}

/**
 * Etiqueta de la modalidad para el select del paso. No reusa la del CRUD de
 * trabajos (`app/(app)/cruds/...`): ese CRUD se archiva en R4 y el wizard no
 * debe depender de código archivado.
 */
export const ETIQUETA_MODALIDAD: Record<string, string> = {
  horas_variables: "Por hora (horas variables)",
  horas_fijas: "Por hora (horas fijas)",
  fijo: "Monto fijo por período",
  por_tarea: "Por tarea",
};

export interface SeleccionItems {
  idsJornadas: string[];
  idsTareas: string[];
  /** Σ de los montos tildados: es el monto **calculado** de la liquidación. */
  monto: number;
  /** Rango derivado (min/max de las fechas tildadas); "" si no hay nada tildado. */
  fechaDesde: string;
  fechaHasta: string;
}

/**
 * Arma la selección a partir de los ítems tildados. El monto sale de la **suma
 * nominal** de sus montos (misma cuenta que hace el backend en `cobrarTrabajo`).
 */
export function seleccionDeItems(
  items: ItemPendienteOut[],
  ids: string[]
): SeleccionItems {
  const tildados = items.filter((i) => ids.includes(i.id));
  const fechas = tildados.map((i) => i.fecha).sort();
  return {
    idsJornadas: tildados.filter((i) => i.tipo === "jornada").map((i) => i.id),
    idsTareas: tildados.filter((i) => i.tipo === "tarea").map((i) => i.id),
    monto: Number(tildados.reduce((s, i) => s + i.monto, 0).toFixed(2)),
    fechaDesde: fechas[0] ?? "",
    fechaHasta: fechas[fechas.length - 1] ?? "",
  };
}

/** Todos los ids de una lista de ítems (para el "todos tildados" inicial). */
export function idsDeItems(items: ItemPendienteOut[]): string[] {
  return items.map((i) => i.id);
}
