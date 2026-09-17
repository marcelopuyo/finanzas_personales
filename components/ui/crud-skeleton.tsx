import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

/**
 * Fallback de navegación de los CRUD (2026-09-17).
 *
 * La forma imita a `CrudTable` en mobile/desktop: encabezado (flecha + título) y
 * la tarjeta con la grilla —mismo padding y mismo borde—, así el contenido real
 * ocupa el lugar sin saltos. Antes había UN solo `loading.tsx` genérico en
 * `app/(app)/`: ahora cada CRUD tiene el suyo (todos usan este componente) para
 * poder ajustar la forma de una pantalla puntual sin tocar las demás.
 *
 * ⚠️ Igual que el resto de los skeletons, va envuelto en `.sk-fade`
 * (globals.css): si la página llega en menos de ~150 ms, el skeleton no se ve.
 */
export function CrudSkeleton({
  rows = 5,
  topCard = false,
}: {
  /** Filas simuladas de la grilla. */
  rows?: number;
  /** Card de resumen arriba de la grilla (p. ej. el detalle de un período). */
  topCard?: boolean;
}) {
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

      {topCard && (
        <div className="mb-4 space-y-2.5 rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-3 w-32" />
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <TableSkeleton rows={rows} />
      </div>
    </div>
  );
}
