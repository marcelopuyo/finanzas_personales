import { getAllPrestamos } from "@/backend/src/queries/prestamos";
import { fetchDashboardData } from "../dashboard-data";
import { DashboardClient } from "../dashboard-client";
import { PrestamosListClient } from "@/app/(app)/cruds/prestamos/list-client";

/**
 * **Préstamos** (2026-10-01, rama `rediseno-ui`) — destino del popup del botón
 * "Más" de la barra inferior.
 *
 * La pantalla **une las dos cosas que antes estaban separadas**:
 * 1. El **gráfico** de préstamos pendientes (con sus badges de saldo neto), que
 *    vivía como panel del dashboard.
 * 2. La **grilla de préstamos**, a la que antes se llegaba por el ⋯ →
 *    "Gestionar préstamos" (`PrestamosListClient`, con su edición, borrado, swipe y
 *    el botón Pagar/Cobrar).
 *
 * 🔑 Es la **filosofía nueva de todas las pantallas**: el panel/gráfico arriba y su
 * listado **debajo**, en la misma pantalla (misma decisión que Gastos y que el
 * replanteo de Ingresos).
 */
export default async function PrestamosTabPage() {
  const [data, prestamos] = await Promise.all([
    fetchDashboardData(),
    getAllPrestamos().catch(() => []),
  ]);

  return (
    <>
      <DashboardClient data={data} solo="prestamos" />
      {/* La grilla va embebida: sin botón "volver" (ya estamos en su pantalla). */}
      <div className="pb-8">
        <PrestamosListClient
          initialData={prestamos}
          embebido
          volverA="/dashboard/prestamos"
        />
      </div>
    </>
  );
}
