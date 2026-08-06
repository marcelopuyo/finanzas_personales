import { z } from "zod";

// Schemas del CRUD de usuarios (panel de administración).

export const usuarioCreateSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  nombre: z.string().max(100).optional(),
  activo: z.boolean().default(true),
  esAdmin: z.boolean().default(false),
});

export const usuarioUpdateSchema = z.object({
  email: z.string().email("Email inválido").optional(),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .optional(),
  nombre: z.string().max(100).optional(),
  emailVerificado: z.boolean().optional(),
  activo: z.boolean().optional(),
  esAdmin: z.boolean().optional(),
});
