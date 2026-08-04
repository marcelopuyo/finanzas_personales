import { z } from "zod";
export const personaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  telefono: z.string().optional(),
  mail: z.string().email("Email inválido").optional().or(z.literal("")),
});
export type PersonaFormData = z.infer<typeof personaSchema>;
export const personaFields = [
  { name: "nombre", label: "Nombre", type: "text" as const, placeholder: "Nombre completo" },
  { name: "telefono", label: "Teléfono", type: "text" as const, placeholder: "Opcional" },
  { name: "mail", label: "Email", type: "text" as const, placeholder: "Opcional" },
];
