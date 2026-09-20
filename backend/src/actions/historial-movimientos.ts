"use server";

import { getHistorialMovimientosCuentaPaginado } from "../queries/movimientos";

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
