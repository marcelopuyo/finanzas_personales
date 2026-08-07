import { z } from "zod";

// Schemas de autenticación (reemplazan class-validator, igual que el resto).

export const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres"),
  nombre: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
  recordar: z.boolean().optional(),
});
