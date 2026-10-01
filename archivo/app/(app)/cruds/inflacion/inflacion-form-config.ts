import { z } from "zod";
export const inflacionSchema = z.object({
  fechaInicial: z.string().min(1, "Fecha requerida"),
  fechaFinal: z.string().min(1, "Fecha requerida"),
  indice: z.coerce.number().positive("Debe ser positivo"),
});
export type InflacionFormData = z.infer<typeof inflacionSchema>;
export const inflacionFields = [
  { name: "fechaInicial", label: "Fecha Inicial", type: "date" as const },
  { name: "fechaFinal", label: "Fecha Final", type: "date" as const },
  { name: "indice", label: "Índice", type: "number" as const, placeholder: "0.00" },
];
