import { fetchDashboardData } from "./dashboard-data";
import { DashboardClient } from "./dashboard-client";
import { DashboardScrollKeeper } from "./components/dashboard-scroll-keeper";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ periodos?: string }>;
}) {
  const { periodos } = await searchParams;
  let data: Awaited<ReturnType<typeof fetchDashboardData>>;
  try {
    data = await fetchDashboardData();
  } catch (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-danger">
            Error al cargar los datos
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </p>
        </div>
      </div>
    );
  }
  return (
    <>
      {/* Restaura el scroll del <main> al volver de un CRUD (ver componente). */}
      <DashboardScrollKeeper />
      {/* periodosInicial: si se vuelve desde la pantalla de un período
          (?periodos=cobrar|actuales) se reabre ese popup automáticamente. */}
      <DashboardClient data={data} periodosInicial={periodos} />
    </>
  );
}
