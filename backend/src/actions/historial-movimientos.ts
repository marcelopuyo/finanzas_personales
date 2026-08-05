"use server";

import { getHistorialMovimientosCuenta } from "../queries/movimientos";

/**
 * Server Action de LECTURA: historial cronológico de movimientos de una cuenta
 * (fecha, monto, motivo, saldo posterior). Para consumir desde componentes cliente.
 */
export async function getHistorialMovimientosCuentaAction(cuentaId: number) {
  return getHistorialMovimientosCuenta(cuentaId);
}
