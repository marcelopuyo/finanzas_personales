import { z } from "zod";

/** Esquema zod para crear/editar Concepto */
export const conceptoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  categoria: z.enum(["Ingreso", "Egreso"], {
    errorMap: () => ({ message: "Seleccione una categoría" }),
  }),
});

export type ConceptoFormData = z.infer<typeof conceptoSchema>;

/** Definición de campos del formulario */
export const conceptoFields = [
  {
    name: "nombre",
    label: "Nombre",
    type: "text" as const,
    placeholder: "Ej. Sueldo, Alquiler",
  },
  {
    name: "categoria",
    label: "Categoría",
    type: "select" as const,
    options: [
      { value: "Ingreso", label: "Ingreso" },
      { value: "Egreso", label: "Egreso" },
    ],
  },
];
