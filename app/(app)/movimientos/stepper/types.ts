import type { CuentaOut } from "@/backend/src/queries/maestros";
import type { PeriodoTrabajoOut } from "@/backend/src/queries/trabajos";
import type { PrestamoOut } from "@/backend/src/queries/prestamos";
import type { CategoriaGastoOut, GastoOut } from "@/backend/src/queries/gastos";

export type MovimientoConcepto =
  | "CobroSueldo"
  | "PagoPrestamo"
  | "AjusteCuenta"
  | "PagoGasto"
  | "GastoDirecto"
  | "Transferencia"
  | "JornadaTrabajo";

/** Datos acumulados del wizard (patrón StepperData del frontend original). */
export interface MovimientoData {
  concepto: MovimientoConcepto | "";
  fecha: string; // "YYYY-MM-DD"
  montoOrigen: number;
  montoDestino: number;
  cuentaOrigen: number;
  cuentaDestino: number;
  periodoTrabajo: number;
  idPrestamo: string;
  idGasto: string;
  idCategoriaGasto: number;
  motivo: string;
  descripcion: string;
  // Jornada de trabajo (wizard)
  horaDesde: string; // "HH:MM"
  horaHasta: string; // "HH:MM"
  montoPropina: number;
  /** Cuenta donde se deposita la propina (si montoPropina > 0). */
  cuentaPropina: number;
}

/** Opciones precargadas en el Server Component para los selects del wizard. */
export interface MovimientoOptions {
  cuentas: CuentaOut[];
  /** Solo períodos de trabajo sin fecha de cobro (pendientes de cobrar). */
  periodosTrabajo: PeriodoTrabajoOut[];
  /** Préstamos pendientes (saldo > 0). */
  prestamos: PrestamoOut[];
  /** Gastos pendientes (saldo > 0). */
  gastos: GastoOut[];
  categoriasGasto: CategoriaGastoOut[];
}

/** Índice de paso del wizard al que lleva cada tipo de movimiento (0=Selector, 8=Confirmación). */
export const CONCEPTO_STEP: Record<MovimientoConcepto, number> = {
  CobroSueldo: 1,
  PagoPrestamo: 2,
  AjusteCuenta: 3,
  PagoGasto: 4,
  GastoDirecto: 5,
  Transferencia: 6,
  JornadaTrabajo: 7,
};

/** Índice del paso de Confirmación (el último del wizard). */
export const STEP_CONFIRMACION = 8;

/** Motivos posibles de transferencia (igual que el enum backend). */
export const MOTIVOS_TRANSFERENCIA = [
  "Transferencia",
  "Compra Dolares",
  "Venta Dolares",
  "Extraccion",
  "Deposito",
] as const;
