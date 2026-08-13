// Capa de datos del wizard de Movimientos (se ejecuta en Server Component).
import { getAllCuentas } from "@/backend/src/queries/maestros";
import {
  getAllPeriodosTrabajo,
  getAllTrabajos,
} from "@/backend/src/queries/trabajos";
import { getPrestamosPendientes } from "@/backend/src/queries/prestamos";
import {
  getAllCategoriasGasto,
  getGastosPendientes,
} from "@/backend/src/queries/gastos";
import type { MovimientoOptions } from "./stepper/types";

export async function getMovimientoOptions(): Promise<MovimientoOptions> {
  const [
    cuentas,
    periodosTrabajo,
    trabajos,
    prestamos,
    gastos,
    categoriasGasto,
  ] = await Promise.all([
    getAllCuentas(),
    getAllPeriodosTrabajo(),
    getAllTrabajos(),
    getPrestamosPendientes(),
    getGastosPendientes(),
    getAllCategoriasGasto(),
  ]);

  return {
    cuentas,
    trabajos,
    prestamos,
    gastos,
    categoriasGasto,
    // Solo períodos SIN fecha de cobro (null o fecha centinela < 1901-01-02),
    // misma lógica que el dashboard y fetchPeriodosTrabajo.
    periodosTrabajo: periodosTrabajo.filter((p) => {
      if (!p.fechaDeCobro) return true;
      return new Date(p.fechaDeCobro) < new Date("1901-01-02");
    }),
  };
}
