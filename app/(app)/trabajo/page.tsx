import { getItemsPendientesCobro, getLiquidacionesCobradasPaginado } from "@/backend/src/queries/trabajos";
import { getAllCuentas } from "@/backend/src/queries/maestros";
import { getSessionUser } from "@/backend/src/lib/auth";
import { TrabajoClient } from "./trabajo-client";

/** Filas por tanda del scroll infinito (la consulta acota el valor a 1..100). */
const PAGE = 20;

/**
 * Pantalla **"Períodos de trabajo"** (`/trabajo`) — el destino del panel
 * "Trabajo" del dashboard.
 *
 * En el modelo nuevo (plan-liquidaciones.md) el usuario ya no gestiona períodos:
 * la pantalla muestra **una sola grilla** (decisión del usuario 2026-09-26) con
 * las dos cosas que existen en el circuito —, **primero los pendientes**
 * (jornadas/tareas sin liquidar, agrupadas por trabajo) y **después las
 * liquidaciones cobradas** —, con el **mismo diseño de fila** y el color del
 * monto como única diferencia (verde = falta cobrar, blanco = cobrado).
 *
 * Las cobradas se cargan **por tandas** (scroll infinito): acá se resuelve la
 * primera y el cliente pide el resto con `getLiquidacionesCobradasPaginaAction`.
 *
 * Las acciones de carga (jornada/tarea, gestionar trabajos) viven en el menú ⋯
 * del encabezado y el cobro se hace desde el wizard.
 */
export default async function TrabajoPage() {
  const [pendientes, primeraPagina, cuentas, sessionUser] = await Promise.all([
    getItemsPendientesCobro().catch(() => []),
    // Primera tanda de liquidaciones COBRADAS (fecha de cobro DESC).
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
    <TrabajoClient
      pendientes={pendientes}
      cobradosIniciales={primeraPagina.filas}
      hayMasCobrados={primeraPagina.hayMas}
      totalCobrados={primeraPagina.total}
      cuentas={cuentas.map((c) => ({ id: c.id, nombre: c.nombre }))}
      monedaISO={sessionUser?.monedaPredeterminada?.codigoISO ?? "USD"}
    />
  );
}
