import { getDb } from "../db";
import { getSessionUser } from "./auth";
import { convertir } from "./cotizaciones";
import { Prestamo } from "../entities/prestamo.entity";

/**
 * Helpers de dominio de PRÉSTAMOS (backend).
 *
 * Un préstamo tiene UNA sola persona: la CONTRAPARTE (la otra parte es siempre
 * el usuario de la app). Su rol se deriva de `sentido`:
 *  - `otorgado` (yo presto)  → me deben  → el saldo pendiente SUMA al neto.
 *  - `obtenido` (me prestan) → yo debo   → el saldo pendiente RESTA al neto.
 */

/** Saldo pendiente FIRMADO según el sentido del préstamo. */
export function saldoFirmado(p: { saldo: number; sentido: string }): number {
  return (p.saldo ?? 0) * (p.sentido === "obtenido" ? -1 : 1);
}

/**
 * Saldo neto de los préstamos pendientes en la moneda PREDETERMINADA del
 * usuario (cada préstamo se convierte desde la moneda de su cuenta, igual que
 * hace `getBalanceActual` con las cuentas). Puede ser negativo.
 */
export async function getPrestamosNetoEnPredeterminada(
  userId: number
): Promise<number> {
  const ds = await getDb();
  const sesion = await getSessionUser();
  const predeterminada = sesion?.monedaPredeterminada;
  const hoy = new Date();

  const rows = await ds.getRepository(Prestamo).find({
    where: { usuario: { id: userId }, eliminado: false },
    relations: { cuenta: { moneda: true } },
  });

  let neto = 0;
  for (const p of rows) {
    const firmado = saldoFirmado(p);
    // Un préstamo ya saldado aporta 0: no hace falta convertir.
    if (firmado === 0) continue;
    neto += await convertir(firmado, p.cuenta?.moneda, predeterminada, hoy);
  }
  return neto;
}
