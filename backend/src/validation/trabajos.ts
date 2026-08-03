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
  idPeriodo: z.number(), // id del período de trabajo
});
export const jornadaTrabajoUpdateSchema = jornadaTrabajoCreateSchema.partial();
