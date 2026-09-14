import {
  ChartSkeleton,
  ListSkeleton,
  Skeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

/**
 * Fallback de navegación del DASHBOARD: es la página más cara (7 consultas), así
 * que tiene su propio skeleton con la MISMA estructura que el contenido real
 * (Balance · Cuentas · Trabajo · secciones con gráficos) para que al llegar los
 * datos no se mueva nada.
 *
 * ⚠️ `sk-fade` (globals.css) retrasa la aparición ~150 ms: si el dashboard
 * responde antes (p. ej. volviendo con el botón atrás gracias al cache del
 * router), el skeleton no se ve.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Cargando resumen"
      className="sk-fade space-y-6 pb-8 pt-4 lg:pt-0"
    >
      {/* Balance Actual */}
      <div className="relative flex min-h-31.75 items-center justify-center rounded-lg border border-border bg-card p-4">
        <Skeleton className="absolute left-4 top-4 h-4 w-28 bg-border" />
        <Skeleton className="h-8 w-40" />
      </div>

      {/* Panel Cuentas */}
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <Skeleton className="mb-3 h-4 w-20 bg-border" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 rounded-lg border border-border bg-muted p-4"
            >
              <Skeleton className="h-3 w-20 bg-card/60" />
              <Skeleton className="h-6 w-24 bg-card/60" />
              <Skeleton className="h-10 w-full bg-card/60" />
            </div>
          ))}
        </div>
      </div>

      {/* Panel Trabajo */}
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <Skeleton className="mb-3 h-4 w-20 bg-border" />
        <ListSkeleton rows={3} />
      </div>

      {/* Gastos · Ingresos (gráficos) */}
      <ChartSkeleton />
      <ChartSkeleton />

      {/* Detalle (tabla) */}
      <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <TableSkeleton rows={4} />
      </div>
    </div>
  );
}
