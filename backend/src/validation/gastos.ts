import { z } from "zod";

// Reemplaza a class-validator. Reglas equivalentes a los DTOs del backend NestJS.

// Fechas llegan como string ISO (IsDateString en el backend)
const dateString = z.string().min(1);

// ---- Categoría de gasto ----
export const categoriaGastoCreateSchema = z.object({
  nombre: z.string().min(1),
});
export const categoriaGastoUpdateSchema = categoriaGastoCreateSchema.partial();

// ---- Gasto ----
// nombreCategoria se recibe por NOMBRE (como en el backend).
// El saldo se recalcula = monto al crear (el backend hace lo mismo).
export const gastoCreateSchema = z.object({
  descripcion: z.string().optional(),
  monto: z.number().positive(),
  saldo: z.number().optional().default(0),
  fechaVencimiento: dateString.optional(),
  fechaPago: dateString.optional(),
  isPeriodico: z.boolean().optional().default(false),
  nombreCategoria: z.string().min(1),
});
export const gastoUpdateSchema = gastoCreateSchema.partial();
