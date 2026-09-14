import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

/**
 * Fallback de navegación para TODA el área de la app (`(app)`): cubre los CRUD
 * y cualquier página que no tenga su propio `loading.tsx` más específico (p. ej.
 * el dashboard, que tiene el suyo).
 *
 * ⚠️ `sk-fade` (globals.css) retrasa la aparición ~150 ms: si la página llega
 * antes, el skeleton no se ve nunca (evita el parpadeo). La forma imita a
 * `CrudTable`: encabezado + tarjeta con la grilla, con el mismo padding, para
 * que el contenido real ocupe el lugar sin saltos.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Cargando página"
      className="sk-fade mx-auto max-w-5xl px-4 py-6 lg:py-8"
    >
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-6 w-44" />
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <TableSkeleton rows={5} />
      </div>
    </div>
  );
}
