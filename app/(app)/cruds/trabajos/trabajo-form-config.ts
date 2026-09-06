import { z } from "zod";
import type { FormField } from "@/components/crud/CrudForm";

// Modalidades de cobro de un trabajo (2026-09-04/05).
export const MODALIDAD_TRABAJO = [
  { value: "horas_variables", label: "Por hora (horas variables)" },
  { value: "horas_fijas", label: "Por hora (horas fijas)" },
  { value: "fijo", label: "Monto fijo por período" },
  { value: "por_tarea", label: "Por tarea" },
] as const;

export const MODALIDAD_LABEL: Record<string, string> = Object.fromEntries(
  MODALIDAD_TRABAJO.map((m) => [m.value, m.label])
);

export const trabajoSchema = z
  .object({
    nombre: z.string().min(1, "El nombre es requerido"),
    fechaInicio: z.string().min(1, "Fecha requerida"),
    modalidadCobro: z.enum([
      "horas_variables",
      "horas_fijas",
      "fijo",
      "por_tarea",
    ]),
    // precioHora solo se pide para las modalidades por hora (superRefine).
    precioHora: z.coerce.number().optional(),
    memos: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.modalidadCobro !== "fijo" && val.modalidadCobro !== "por_tarea") {
      if (!val.precioHora || Number(val.precioHora) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["precioHora"],
          message: "Indicá el precio por hora para esta modalidad",
        });
      }
    }
  });
export type TrabajoFormData = z.infer<typeof trabajoSchema>;

export const trabajoFields: FormField[] = [
  { name: "nombre", label: "Nombre", type: "text" as const, placeholder: "Ej. Grand Cafe" },
  { name: "fechaInicio", label: "Fecha Inicio", type: "date" as const },
  {
    name: "modalidadCobro",
    label: "Modalidad de cobro",
    type: "select" as const,
    options: MODALIDAD_TRABAJO.map((m) => ({ value: m.value, label: m.label })),
  },
  {
    name: "precioHora",
    label: "Precio Hora",
    type: "number" as const,
    placeholder: "0.00",
    // Oculto para monto fijo y por tarea (no usan precio por hora).
    showIf: (v) => {
      const m = v.modalidadCobro as string | undefined;
      return !!m && m !== "fijo" && m !== "por_tarea";
    },
  },
  { name: "memos", label: "Memos", type: "textarea" as const, placeholder: "Notas..." },
];
