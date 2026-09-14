import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

/**
 * Bloque de carga (skeleton). Se usa dentro de los `loading.tsx` de cada ruta
 * (fallback de navegación) y en las vistas que hacen fetch en el cliente.
 *
 * ⚠️ Los `loading.tsx` van envueltos en la clase `.sk-fade` (globals.css), que
 * retrasa la aparición ~150 ms para no parpadear en las páginas rápidas.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-muted motion-reduce:animate-none",
        className
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-3 w-24 bg-border" />
      <Skeleton className="h-6 w-36 bg-border" />
      <Skeleton className="h-3 w-20 bg-border" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-5">
      <div className="h-4 w-28 animate-pulse rounded bg-border" />
      <div className="h-64 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

/**
 * Skeletons con la FORMA de la página destino (grilla, tabla, lista): la idea
 * es que el reemplazo no mueva nada — mismas alturas, mismos bordes y mismo
 * fondo que el contenido real (`rounded-lg border bg-card`).
 */

/** Grilla de tarjetas (cuentas del dashboard, resúmenes, etc.). */
export function CardsGridSkeleton({
  cols = 4,
  cards = 4,
}: {
  cols?: 2 | 3 | 4;
  cards?: number;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2",
        cols === 3 && "lg:grid-cols-3",
        cols === 4 && "lg:grid-cols-4"
      )}
    >
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-lg border border-border bg-muted p-4"
        >
          <Skeleton className="h-3 w-20 bg-card/60" />
          <Skeleton className="h-6 w-28 bg-card/60" />
          <Skeleton className="h-10 w-full bg-card/60" />
        </div>
      ))}
    </div>
  );
}

/** Tabla genérica (grillas de los CRUD, detalle de ingresos/gastos). */
export function TableSkeleton({
  rows = 6,
  showHeader = true,
}: {
  rows?: number;
  showHeader?: boolean;
}) {
  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-center gap-3 border-b border-border pb-2">
          <Skeleton className="h-3.5 w-24 bg-border" />
          <Skeleton className="h-3.5 w-20 bg-border" />
          <Skeleton className="ml-auto h-3.5 w-16 bg-border" />
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <Skeleton className="h-4 w-[38%] max-w-40" />
          <Skeleton className="h-4 w-[22%] max-w-24" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Lista de filas con dos líneas (panel Trabajo, movimientos recientes). */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="space-y-1.5 border-t border-border py-2.5 first:border-t-0"
        >
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-3 w-44" />
        </div>
      ))}
    </div>
  );
}
