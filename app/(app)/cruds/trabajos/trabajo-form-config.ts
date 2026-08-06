import { z } from "zod";
export const trabajoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  fechaInicio: z.string().min(1, "Fecha requerida"),
  precioHora: z.coerce.number().positive("Debe ser positivo"),
  memos: z.string().optional(),
});
export type TrabajoFormData = z.infer<typeof trabajoSchema>;
export const trabajoFields = [
  { name: "nombre", label: "Nombre", type: "text" as const, placeholder: "Ej. Grand Cafe" },
  { name: "fechaInicio", label: "Fecha Inicio", type: "date" as const },
  { name: "precioHora", label: "Precio Hora", type: "number" as const, placeholder: "0.00" },
  { name: "memos", label: "Memos", type: "textarea" as const, placeholder: "Notas..." },
];
