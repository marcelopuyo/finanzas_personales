import { fetchDashboardData } from "./dashboard-data";
import { DashboardClient } from "./dashboard-client";
import { DashboardScrollKeeper } from "./components/dashboard-scroll-keeper";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string }>;
}) {
  const { panel } = await searchParams;
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
      {/* Restaura el scroll del `<main>` al volver de un CRUD… o lo lleva al
          panel pedido por voz (`?panel=gastos`, §15.2 del plan de voz). */}
      <DashboardScrollKeeper panel={panel} />
      <DashboardClient data={data} />
    </>
  );
}
