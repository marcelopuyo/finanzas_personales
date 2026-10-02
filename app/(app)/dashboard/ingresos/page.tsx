import { getAllCuentas } from "@/backend/src/queries/maestros";
import { getSessionUser } from "@/backend/src/lib/auth";
import {
  getItemsPendientesCobro,
  getLiquidacionesCobradasPaginado,
} from "@/backend/src/queries/trabajos";
import { fetchDashboardData } from "../dashboard-data";
import { DashboardClient } from "../dashboard-client";
import { TrabajoClient } from "@/app/(app)/trabajo/trabajo-client";

/** Filas por tanda del scroll infinito de las liquidaciones cobradas. */
const PAGE = 20;

/**
 * Tab **Ingresos** (2026-10-01, rama `rediseno-ui`) — el **replanteo** de la
 * pantalla: antes la info estaba repartida en TRES lugares (el panel "Trabajo"
 * del dashboard con las tandas estimadas, la pantalla `/trabajo` con la grilla de
 * pendientes + cobradas, y la pestaña *Detalle* del panel Ingresos).
 *
 * Ahora es **una sola pantalla** con la filosofía general del rediseño:
 * 1. **Fila de encabezado** en su panel: título + badge + Filtros + ⋯.
 * 2. **Panel de gráficos** con su selector (Resumen · Histórico) y, dentro, el
 *    **resumen de las tandas** (por cobrar · en curso · sin período, con montos y
 *    cantidades).
 * 3. **Listado unificado debajo**: la grilla de `TrabajoClient` **embebida**
 *    —pendientes por trabajo (que se despliegan ítem por ítem, con edición y
 *    borrado) **y** las liquidaciones cobradas con scroll infinito— más el FAB ➕
 *    de acciones del circuito.
 *
 * `/trabajo` deja de ser una pantalla propia y **redirige** acá.
 */
export default async function IngresosTabPage() {
  const [data, pendientes, primeraPagina, cuentas, sessionUser] =
    await Promise.all([
      fetchDashboardData(),
      getItemsPendientesCobro().catch(() => []),
      getLiquidacionesCobradasPaginado(0, PAGE).catch(() => ({
        filas: [],
        hayMas: false,
        total: 0,
      })),
      // Cuentas para el select del depósito de propina del formulario de edición.
      getAllCuentas().catch(() => []),
      getSessionUser(),
    ]);

  return (
    <>
      <DashboardClient data={data} solo="ingresos" />
      <div className="pb-8">
        <TrabajoClient
          embebido
          // El reparto en ventanas viaja CRUDO: la grilla lo recalcula con la
          // fecha **local** del navegador (fix de §211, `useVentanasCobro`).
          estimacionesSSR={data.cobrosEstimados}
          hoyServidor={data.hoyServidor}
          ingresosDetalle={data.ingresosDetalle}
          pendientes={pendientes}
          cobradosIniciales={primeraPagina.filas}
          hayMasCobrados={primeraPagina.hayMas}
          totalCobrados={primeraPagina.total}
          cuentas={cuentas.map((c) => ({ id: c.id, nombre: c.nombre }))}
          monedaISO={sessionUser?.monedaPredeterminada?.codigoISO ?? "USD"}
        />
      </div>
    </>
  );
}
