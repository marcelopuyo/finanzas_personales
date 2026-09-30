import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

/**
 * Fallback de navegación de la pantalla `/gastos`: imita la forma real
 * (encabezado, campo de búsqueda y la lista) para que el contenido ocupe su
 * lugar sin saltos. Va envuelto en `.sk-fade` (anti-flicker).
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Cargando página"
      className="sk-fade mx-auto max-w-5xl pb-8 pt-4 lg:pt-0"
    >
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-6 w-28" />
      </div>

      <Skeleton className="h-9 w-full rounded-full" />

      <Skeleton className="mb-3 mt-3 h-4 w-32" />

      <div className="rounded-lg border border-border bg-card p-2">
        <TableSkeleton rows={6} />
      </div>
    </div>
  );
}
