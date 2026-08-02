export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Resumen de tus finanzas personales</p>
      </div>

      {/* Placeholder - se implementará en Fase 3 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-3 h-4 w-24 rounded bg-muted" />
            <div className="h-8 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="animate-pulse rounded-xl border border-border bg-card p-6">
          <div className="mb-4 h-5 w-40 rounded bg-muted" />
          <div className="h-64 rounded bg-muted" />
        </div>
        <div className="animate-pulse rounded-xl border border-border bg-card p-6">
          <div className="mb-4 h-5 w-40 rounded bg-muted" />
          <div className="h-64 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
