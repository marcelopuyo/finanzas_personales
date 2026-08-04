import { z } from "zod";

export const categoriaGastoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
});

export type CategoriaGastoFormData = z.infer<typeof categoriaGastoSchema>;

export const categoriaGastoFields = [
  {
    name: "nombre",
    label: "Nombre",
    type: "text" as const,
    placeholder: "Ej. Supermercado, Servicios",
  },
];
