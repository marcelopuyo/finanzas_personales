import { z } from "zod";

// Reemplaza a class-validator. Reglas equivalentes a los DTOs del backend NestJS.

export const motivoMovimientoSchema = z.enum([
  "Transferencia",
  "Compra Dolares",
  "Venta Dolares",
  "Extraccion",
  "Deposito",
]);

const dateString = z.string().min(1);

// Movimiento tipo 1 — CobroSueldo / PagoPrestamo / AjusteCuenta / PagoGasto
export const movimiento1Schema = z.object({
  fecha: dateString,
  monto: z.number(),
  idCuenta: z.number(),
  idPeriodoTrabajo: z.number().optional(),
  idGasto: z.string().optional(),
  idPrestamo: z.string().optional(),
});

// Movimiento tipo 2 — Transferencia
export const movimiento2Schema = z.object({
  fecha: dateString,
  montoOrigen: z.number().optional(),
  idCuentaOrigen: z.number().optional(),
  montoDestino: z.number().optional(),
  idCuentaDestino: z.number().optional(),
  motivo: motivoMovimientoSchema,
});

// Movimiento tipo 3 — GastoDirecto
export const movimiento3Schema = z.object({
  descripcion: z.string().min(1),
  fecha: dateString,
  monto: z.number(),
  idCuenta: z.number(),
  idCategoriaGasto: z.number(),
});

// Movimiento tipo 4 — Jornada de trabajo desde el wizard.
// Crea la jornada (como el CRUD) y, si montoPropina > 0, la deposita en idCuenta.
export const jornadaStepperSchema = z.object({
  fecha: dateString,
  horaDesde: z.number(),
  horaHasta: z.number(),
  montoPropina: z.number().optional().default(0),
  // idPeriodo es opcional: si llega crearPeriodoAutomatico = true se crea un
  // período de una sola jornada (fechaDesde = fechaHasta = fecha) y NO se usa
  // un período existente.
  idPeriodo: z.number().optional(),
  idCuenta: z.number().optional(),
  // Período automático: el usuario lo elige EXPLÍCITAMENTE (opción del select)
  // para crear el período junto con la jornada (evita creación accidental).
  // Requiere idTrabajo para saber a qué trabajo pertenece el período nuevo.
  crearPeriodoAutomatico: z.boolean().optional().default(false),
  idTrabajo: z.number().optional(),
});
