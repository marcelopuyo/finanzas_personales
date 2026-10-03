import { fetchDashboardData } from "./dashboard-data";
import { getGastosPaginado, type GastosPagina } from "@/backend/src/queries/gastos";
import { DashboardClient, type Vista } from "./dashboard-client";

/** Filas de la primera tanda del listado embebido de gastos. */
const PAGINA_GASTOS = 20;

/**
 * Render de una **vista del dashboard** (2026-10-01, rama `rediseno-ui`).
 *
 * Cada tab de la barra inferior es una ruta propia (`/dashboard/gastos`,
 * `/dashboard/ingresos`, …) que pinta **solo su panel**, en vez de una única
 * página con los 7 paneles apilados. Vive acá para no repetir el manejo de error
 * en las 4 rutas.
 *
 * ⚠️ **Fase 1**: el `fetch` sigue trayendo el payload completo del dashboard (el
 * mismo que antes); lo que cambia es qué se **monta**. El recorte del payload por
 * pantalla queda para una segunda pasada.
 */
export async function VistaPage({ vista }: { vista: Vista }) {
  let data: Awaited<ReturnType<typeof fetchDashboardData>>;
  /**
   * Primera tanda del listado **completo** de gastos (solo en la pantalla Gastos):
   * su segundo panel embebe `GastosClient` (búsqueda + scroll infinito) en vez de
   * las tarjetas de los últimos 3 días ⇒ misma resolución que Ingresos.
   */
  let gastosPrimeraPagina: GastosPagina | undefined;
  try {
    const [d, g] = await Promise.all([
      fetchDashboardData(),
      vista === "gastos"
        ? getGastosPaginado({ offset: 0, limit: PAGINA_GASTOS }).catch(
            () => undefined
          )
        : Promise.resolve(undefined),
    ]);
    data = d;
    gastosPrimeraPagina = g;
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
    <DashboardClient
      data={data}
      solo={vista}
      gastosPrimeraPagina={gastosPrimeraPagina}
    />
  );
}
