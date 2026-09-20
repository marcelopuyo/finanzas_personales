import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

/**
 * Fallback de navegación de la pantalla de movimientos de una cuenta
 * (`/cuentas/[id]`): imita la forma real (encabezado, recuadro del saldo y la
 * lista) para que el contenido ocupe el lugar sin saltos. Va envuelto en
 * `.sk-fade`, así no parpadea si la página llega en menos de ~150 ms.
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
        <Skeleton className="h-6 w-44" />
      </div>

      <Skeleton className="h-11 w-full rounded-lg" />

      <Skeleton className="mb-2 mt-5 h-5 w-32" />

      <div className="rounded-lg border border-border bg-card p-2">
        <TableSkeleton rows={6} />
      </div>
    </div>
  );
}
