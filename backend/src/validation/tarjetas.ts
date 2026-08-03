import { z } from "zod";

// Reemplaza a class-validator. Reglas equivalentes a los DTOs del backend NestJS.

const dateString = z.string().min(1);

// ---- Tarjeta ----
export const tarjetaCreateSchema = z.object({
  nombre: z.string().min(1),
  banco: z.string().min(1),
  numero: z.string().min(1),
  cuenta: z.string().min(1), // nombre de la cuenta
});
export const tarjetaUpdateSchema = tarjetaCreateSchema.partial();

// ---- Período de tarjeta ----
export const periodoTarjetaCreateSchema = z.object({
  nombre: z.string().min(1),
  fechaApertura: dateString,
  fechaCierre: dateString,
  fechaVencimiento: dateString,
  tarjeta: z.string().min(1), // nombre de la tarjeta
});
export const periodoTarjetaUpdateSchema = periodoTarjetaCreateSchema.partial();

// ---- Movimiento de tarjeta ----
export const movimientoTarjetaCreateSchema = z.object({
  detalle: z.string().optional(),
  fecha: dateString,
  monto: z.number().positive(),
  cuotas: z.number().positive(),
  tarjeta: z.string().min(1), // nombre
  persona: z.string().min(1), // nombre
  periodo: z.string().min(1), // nombre
});
export const movimientoTarjetaUpdateSchema =
  movimientoTarjetaCreateSchema.partial();
