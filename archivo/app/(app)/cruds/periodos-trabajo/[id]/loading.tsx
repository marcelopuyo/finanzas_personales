import { CrudSkeleton } from "@/components/ui/crud-skeleton";

/**
 * Fallback de navegación del DETALLE de un período (`/cruds/periodos-trabajo/[id]`):
 * la pantalla lleva el resumen del período (trabajo, fechas, total) arriba de la
 * grilla de jornadas/tareas, así que el skeleton incluye esa card.
 */
export default function Loading() {
  return <CrudSkeleton rows={5} topCard />;
}
