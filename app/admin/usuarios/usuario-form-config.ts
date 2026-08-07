import { z } from "zod";
import type { FormField } from "@/components/crud/CrudForm";

// Schemas y campos del CRUD de usuarios (panel admin).
// Los campos lógicos usan type "boolean" (slider). Internamente manejan strings
// "true"/"false" (CrudForm trabaja con strings); el onSubmit los convierte a
// boolean antes de llamar a la action.

export const usuarioCreateFormSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  nombre: z.string().optional(),
  activo: z.enum(["true", "false"]),
  esAdmin: z.enum(["true", "false"]),
});

export const usuarioUpdateFormSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().optional(),
  nombre: z.string().optional(),
  emailVerificado: z.enum(["true", "false"]),
  activo: z.enum(["true", "false"]),
  esAdmin: z.enum(["true", "false"]),
});

export const usuarioCreateFields: FormField[] = [
  { name: "email", label: "Email", type: "text", placeholder: "usuario@mail.com" },
  {
    name: "password",
    label: "Contraseña",
    type: "password",
    placeholder: "Mínimo 8 caracteres",
  },
  { name: "nombre", label: "Nombre", type: "text", placeholder: "Nombre del usuario" },
  { name: "activo", label: "Activo", type: "boolean" },
  { name: "esAdmin", label: "Administrador", type: "boolean" },
];

export const usuarioEditFields: FormField[] = [
  { name: "email", label: "Email", type: "text" },
  {
    name: "password",
    label: "Contraseña (opcional)",
    type: "password",
    placeholder: "Dejar vacío para no cambiar",
  },
  { name: "nombre", label: "Nombre", type: "text" },
  { name: "emailVerificado", label: "Email verificado", type: "boolean" },
  { name: "activo", label: "Activo", type: "boolean" },
  { name: "esAdmin", label: "Administrador", type: "boolean" },
];
