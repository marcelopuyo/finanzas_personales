import { redirect } from "next/navigation";
import {
  getHistorialMovimientosCuentaPaginado,
  type HistorialPagina,
} from "@/backend/src/queries/movimientos";
import { PRIMERA_PAGINA_FILAS } from "@/lib/historial-cuentas";
import { fetchDashboardData } from "./dashboard-data";
import { DashboardScrollKeeper } from "./components/dashboard-scroll-keeper";
import { InicioPanel } from "./components/inicio-panel";

/**
 * Pantalla **Inicio** (`/dashboard`) — el primer tab de la barra inferior
 * (2026-10-01, rama `rediseno-ui`).
 *
 * Reemplaza al dashboard de una sola página con 7 paneles apilados: ahora cada
 * panel vive en su ruta (`/dashboard/gastos`, `/dashboard/ingresos`, …) y acá solo
 * queda el **resumen de cuentas** (balance + carrusel + evolución + movimientos de
 * la cuenta en foco).
 *
 * ⚠️ **Los anclas de voz siguen andando**: las órdenes "ir al panel X" pedían
 * `?panel=X` sobre esta página y ahora se **redirigen** a la ruta del panel. El
 * `DashboardScrollKeeper` se mantiene para restaurar el scroll al volver de un CRUD.
 */
const PANEL_A_RUTA: Record<string, string> = {
  gastos: "/dashboard/gastos",
  ingresos: "/dashboard/ingresos",
  trabajo: "/dashboard/ingresos",
  resultados: "/dashboard/resultados",
  prestamos: "/dashboard/prestamos",
};

/** Cuántas cuentas traen su primera página resuelta en el server. */
const CUENTAS_SEMILLA = 2;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string }>;
}) {
  const { panel } = await searchParams;
  // Las anclas de voz (`?panel=X`) apuntaban a bloques de ESTA página; al separar
  // los paneles en rutas propias se redirige para no romper la navegación por voz.
  const destino = panel ? PANEL_A_RUTA[panel] : undefined;
  if (destino) redirect(destino);

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

  // Las **2 primeras cuentas** traen su primera página resuelta en el server (así
  // Inicio abre con datos y la vecina ya está lista). El resto se precarga en
  // segundo plano desde el cliente, en **una sola** llamada.
  const cuentasConId = data.cuentas.filter((c) => c.id != null);
  const historialesIniciales: Record<number, HistorialPagina> = {};
  await Promise.all(
    cuentasConId.slice(0, CUENTAS_SEMILLA).map(async (c) => {
      historialesIniciales[c.id!] = await getHistorialMovimientosCuentaPaginado(
        c.id!,
        { offset: 0, limit: PRIMERA_PAGINA_FILAS }
      );
    })
  );

  return (
    <>
      {/* Restaura el scroll del `<main>` al volver de un CRUD. */}
      <DashboardScrollKeeper panel={panel} />
      <InicioPanel data={data} historialesIniciales={historialesIniciales} />
    </>
  );
}
