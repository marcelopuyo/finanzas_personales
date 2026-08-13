import { z } from "zod";

// Reemplaza a class-validator. Reglas equivalentes a los DTOs del backend NestJS.

// Categoría de concepto (Ingreso / Egreso)
export const CategoriaConceptoSchema = z.enum(["Egreso", "Ingreso"]);

// Fechas llegan como string ISO (IsDateString en el backend)
const dateString = z.string().min(1);

// ---- Concepto ----
export const conceptoCreateSchema = z.object({
  nombre: z.string().min(1),
  categoria: CategoriaConceptoSchema,
});
export const conceptoUpdateSchema = conceptoCreateSchema.partial();

// ---- Tipo Cuenta ----
export const tipoCuentaCreateSchema = z.object({
  nombre: z.string().min(1),
});
export const tipoCuentaUpdateSchema = tipoCuentaCreateSchema.partial();

// ---- Cuenta ----
export const cuentaCreateSchema = z.object({
  nombre: z.string().min(1),
  saldo: z.number().optional().default(0),
  // tipo y moneda se reciben por NOMBRE (como en el backend)
  tipo: z.string().min(1),
  tarjeta: z.string().optional(),
  moneda: z.string().min(1),
  // Indica si la cuenta participa del "Balance Actual" (default: sí).
  incluirEnBalance: z.boolean().optional().default(true),
});
export const cuentaUpdateSchema = cuentaCreateSchema.partial();

// ---- Persona ----
export const personaCreateSchema = z.object({
  nombre: z.string().min(1),
  telefono: z.string().optional(),
  mail: z.string().email().optional(),
});
export const personaUpdateSchema = personaCreateSchema.partial();

// ---- Moneda ----
export const monedaCreateSchema = z.object({
  simbolo: z.string().min(1),
  nombre: z.string().min(1),
  codigoISO: z.string().min(1).transform((v) => v.trim().toUpperCase()),
});
export const monedaUpdateSchema = monedaCreateSchema.partial();

// ---- Inflación ----
export const inflacionCreateSchema = z.object({
  fechaInicial: dateString,
  fechaFinal: dateString,
  indice: z.number().positive(),
});
export const inflacionUpdateSchema = inflacionCreateSchema.partial();
