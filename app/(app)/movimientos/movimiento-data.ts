// Capa de datos del wizard de Movimientos (se ejecuta en Server Component).
import { getAllCuentas } from "@/backend/src/queries/maestros";
import {
  getAllJornadasTrabajo,
  getAllPeriodosTrabajo,
  getAllTrabajos,
} from "@/backend/src/queries/trabajos";
import { getPrestamosPendientes } from "@/backend/src/queries/prestamos";
import {
  getAllCategoriasGasto,
  getGastosPendientes,
} from "@/backend/src/queries/gastos";
import type { MovimientoOptions } from "./stepper/types";

// Nombres de las tarjetas/cuentas SINTÉTICAS del dashboard ("Períodos a
// Cobrar" y "Períodos Actuales"). No son cuentas reales (se calculan en
// dashboard-data.ts) y NUNCA deben ofrecerse en los selects de cuenta del
// stepper. Si en el futuro se crearan cuentas con estos nombres, quedan
// excluidas aquí (garantía defensiva; hoy no existen en la BD).
const NOMBRES_CUENTAS_SINTETICAS = new Set([
  "Períodos a Cobrar",
  "Períodos Actuales",
]);

export async function getMovimientoOptions(): Promise<MovimientoOptions> {
  const [
    cuentas,
    periodosTrabajo,
    trabajos,
    prestamos,
    gastos,
    categoriasGasto,
    jornadas,
  ] = await Promise.all([
    getAllCuentas(),
    getAllPeriodosTrabajo(),
    getAllTrabajos(),
    getPrestamosPendientes(),
    getGastosPendientes(),
    getAllCategoriasGasto(),
    getAllJornadasTrabajo(),
  ]);

  return {
    // Excluye las cuentas sintéticas de TODOS los selects de cuenta del
    // stepper (wizard y modo directo /movimientos/nuevo/<tipo>).
    cuentas: cuentas.filter((c) => !NOMBRES_CUENTAS_SINTETICAS.has(c.nombre)),
    trabajos,
    prestamos,
    gastos,
    categoriasGasto,
    jornadas: jornadas.map((j) => ({
      fechaJornada: j.fechaJornada,
      horaDesde: j.horaDesde,
      horaHasta: j.horaHasta,
      trabajo: j.trabajo,
    })),
    // Solo períodos SIN fecha de cobro (null o fecha centinela < 1901-01-02),
    // misma lógica que el dashboard y fetchPeriodosTrabajo.
    periodosTrabajo: periodosTrabajo.filter((p) => {
      if (!p.fechaDeCobro) return true;
      return new Date(p.fechaDeCobro) < new Date("1901-01-02");
    }),
  };
}
