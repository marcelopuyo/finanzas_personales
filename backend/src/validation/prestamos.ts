import { z } from "zod";

// Reemplaza a class-validator. Reglas equivalentes a los DTOs del backend NestJS.

const dateString = z.string().min(1);

// Sentido del préstamo (otorgado / obtenido)
export const sentidoSchema = z.enum(["otorgado", "obtenido"]);

export const prestamoCreateSchema = z.object({
  detalle: z.string().optional(),
  fecha: dateString,
  monto: z.number().positive(),
  saldo: z.number(),
  cuotas: z.number().positive(),
  sentido: sentidoSchema,
  personaOrigen: z.string().min(1), // nombre
  personaDestino: z.string().min(1), // nombre
  cuenta: z.string().min(1), // nombre
});
export const prestamoUpdateSchema = prestamoCreateSchema.partial();
