import { fetchDashboardData } from "./dashboard-data";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  try {
    const data = await fetchDashboardData();
    return <DashboardClient data={data} />;
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
}
