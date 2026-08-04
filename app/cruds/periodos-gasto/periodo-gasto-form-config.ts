import { z } from "zod";
export const periodoGastoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  fechaApertura: z.string().min(1, "Fecha requerida"),
  fechaCierre: z.string().min(1, "Fecha requerida"),
});
export type PeriodoGastoFormData = z.infer<typeof periodoGastoSchema>;
export const periodoGastoFields = [
  { name: "nombre", label: "Nombre", type: "text" as const, placeholder: "Ej. Agosto 26" },
  { name: "fechaApertura", label: "Fecha Apertura", type: "date" as const },
  { name: "fechaCierre", label: "Fecha Cierre", type: "date" as const },
];
