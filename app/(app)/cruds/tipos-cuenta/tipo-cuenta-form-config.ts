import { z } from "zod";

export const tipoCuentaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
});

export type TipoCuentaFormData = z.infer<typeof tipoCuentaSchema>;

export const tipoCuentaFields = [
  { name: "nombre", label: "Nombre", type: "text" as const, placeholder: "Ej. Cuenta Bancaria" },
];
