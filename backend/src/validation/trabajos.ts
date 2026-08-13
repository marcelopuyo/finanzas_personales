import { z } from "zod";

// Reemplaza a class-validator. Reglas equivalentes a los DTOs del backend NestJS.

const dateString = z.string().min(1);

// ---- Trabajo ----
export const trabajoCreateSchema = z.object({
  nombre: z.string().min(1),
  fechaInicio: dateString,
  precioHora: z.number().positive(),
  memos: z.string().optional(),
});
export const trabajoUpdateSchema = trabajoCreateSchema.partial();

// ---- Período de trabajo ----
export const periodoTrabajoCreateSchema = z.object({
  fechaDesde: dateString,
  fechaHasta: dateString,
  montoACobrar: z.number().optional(),
  fechaEstimadaCobro: dateString.optional(),
  fechaDeCobro: dateString.optional(),
  nombreTrabajo: z.string().min(1), // nombre del trabajo
});
export const periodoTrabajoUpdateSchema = periodoTrabajoCreateSchema.partial();

// ---- Jornada de trabajo ----
export const jornadaTrabajoCreateSchema = z.object({
  fechaJornada: dateString,
  horaDesde: z.number(),
  horaHasta: z.number(),
  montoPropina: z.number().optional().default(0),
  // idPeriodo es opcional: si llega crearPeriodoAutomatico = true se crea un
  // período de una sola jornada (fechaDesde = fechaHasta = fecha) y NO se usa
  // un período existente.
  idPeriodo: z.number().optional(),
  crearPeriodoAutomatico: z.boolean().optional().default(false),
  idTrabajo: z.number().optional(),
  // Cuenta donde se deposita la propina (requerida si montoPropina > 0).
  idCuenta: z.number().optional(),
});
export const jornadaTrabajoUpdateSchema = jornadaTrabajoCreateSchema.partial();
