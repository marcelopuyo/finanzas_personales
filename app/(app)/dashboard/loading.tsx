import {
  ChartSkeleton,
  ListSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

/**
 * Fallback de navegación del DASHBOARD: es la página más cara (7 consultas), así
 * que tiene su propio skeleton con la MISMA estructura que el contenido real
 * (Balance · Cuentas · Trabajo · los 4 paneles con gráfico) para que al llegar
 * los datos no se mueva nada.
 *
 * ⚠️ La **cantidad y el orden** de los bloques tienen que coincidir con
 * `dashboard-client.tsx`: Balance → Cuentas → Trabajo → **Gastos** → **Ingresos**
 * → **Resultados** → **Préstamos Pendientes**. Con menos bloques que la página,
 * al llegar los datos la página **crece** y salta el layout (arreglado el
 * 2026-10-01: faltaban Resultados y Préstamos y sobraba un bloque "Detalle de
 * Gastos", que en realidad es una **pestaña** dentro del panel Gastos).
 *
 * ⚠️ `sk-fade` (globals.css) retrasa la aparición ~150 ms: si el dashboard
 * responde antes (p. ej. volviendo con el botón atrás gracias al cache del
 * router), el skeleton no se ve.
 */

/**
 * Panel con gráfico: **Gastos** e **Ingresos** (con la fila de pestañas + Filtros),
 * **Resultados** (sólo título + badge) y **Préstamos Pendientes** (con las 2
 * cifras de saldo neto en el encabezado). Los 4 comparten la forma del
 * `EvolutionChart`/`PrestamosChart` real (`rounded-lg border bg-card p-4 sm:p-5`
 * + título + área del gráfico).
 */
function ChartPanelSkeleton({
  tabs = false,
  stats = false,
}: {
  /** Gastos e Ingresos: suma la fila de pestañas + Filtros. */
  tabs?: boolean;
  /** Préstamos: 2 cifras (saldo neto) en lugar del badge. */
  stats?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Skeleton className="h-4 w-24 bg-border" />
        {stats ? (
          <>
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </>
        ) : (
          <Skeleton className="h-5 w-24 rounded-full" />
        )}
      </div>
      {tabs && (
        <div className="mb-4 flex items-center gap-2">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="ml-auto h-7 w-20" />
        </div>
      )}
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

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

      {/* Paneles con gráfico — el ORDEN es el de `dashboard-client.tsx`:
          Gastos (pestañas) · Ingresos (pestañas) · Resultados (título + badge;
          se renderiza SIEMPRE y sin datos muestra su estado vacío) ·
          Préstamos Pendientes (SIEMPRE, con sus 2 cifras de saldo neto). */}
      <ChartPanelSkeleton tabs />
      <ChartPanelSkeleton tabs />
      <ChartSkeleton />
      <ChartPanelSkeleton stats />
    </div>
  );
}
