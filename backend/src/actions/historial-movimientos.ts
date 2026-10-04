"use server";

import {
  getHistorialMovimientosCuentaPaginado,
  type HistorialPagina,
} from "../queries/movimientos";

/**
 * Server Action de LECTURA: una **tanda** del historial cronológico de
 * movimientos de una cuenta (fecha, monto, motivo, saldo posterior). La usa el
 * scroll infinito de `/cuentas/[id]` para no traer el historial completo de una.
 *
 * ⚠️ El tamaño de la página lo propone el cliente (`limit`) y el backend lo acota
 * (1..100). No puede exportarse una constante desde acá: un módulo `"use server"`
 * solo puede exportar funciones `async`.
 */
export async function getHistorialMovimientosCuentaPaginaAction(
  cuentaId: number,
  offset: number,
  limit: number
) {
  return getHistorialMovimientosCuentaPaginado(cuentaId, { offset, limit });
}

/**
 * La **primera página** (offset 0) de VARIAS cuentas de una vez. La usa el
 * carrusel de Inicio para precargar en segundo plano el historial de las cuentas
 * restantes en **una sola** ida al server, en vez de N llamadas.
 */
export async function getHistorialesPrimerasPaginasAction(
  cuentaIds: number[],
  limit: number
): Promise<Record<number, HistorialPagina>> {
  const resultado: Record<number, HistorialPagina> = {};
  await Promise.all(
    cuentaIds.map(async (id) => {
      resultado[id] = await getHistorialMovimientosCuentaPaginado(id, {
        offset: 0,
        limit,
      });
    })
  );
  return resultado;
}
