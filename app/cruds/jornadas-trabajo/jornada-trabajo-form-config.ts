import { z } from "zod";
import type { FormField } from "@/components/crud/CrudForm";
import { fetchPeriodosTrabajo } from "../options";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const jornadaTrabajoSchema = z.object({
  fechaJornada: z.string().min(1, "Fecha requerida"),
  horaDesde: z.string().regex(timeRegex, "Hora inválida (HH:MM)"),
  horaHasta: z.string().regex(timeRegex, "Hora inválida (HH:MM)"),
  montoPropina: z.coerce.number().optional(),
  idPeriodo: z.coerce.number().min(1, "Seleccione un período"),
});
export type JornadaTrabajoFormData = z.infer<typeof jornadaTrabajoSchema>;

export const jornadaTrabajoFields: FormField[] = [
  { name: "fechaJornada", label: "Fecha Jornada", type: "date" },
  { name: "horaDesde", label: "Hora Desde", type: "time" },
  { name: "horaHasta", label: "Hora Hasta", type: "time" },
  { name: "montoPropina", label: "Propina", type: "number", placeholder: "0.00" },
  { name: "idPeriodo", label: "Período", type: "select", optionsFrom: fetchPeriodosTrabajo },
];
