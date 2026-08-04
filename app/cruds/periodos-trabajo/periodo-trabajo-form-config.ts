import { z } from "zod";
import type { FormField } from "@/components/crud/CrudForm";
import { fetchTrabajos } from "../options";

export const periodoTrabajoSchema = z.object({
  fechaDesde: z.string().min(1, "Fecha requerida"),
  fechaHasta: z.string().min(1, "Fecha requerida"),
  montoACobrar: z.coerce.number().optional(),
  fechaEstimadaCobro: z.string().optional(),
  fechaDeCobro: z.string().optional(),
  nombreTrabajo: z.string().min(1, "Seleccione un trabajo"),
});
export type PeriodoTrabajoFormData = z.infer<typeof periodoTrabajoSchema>;

export const periodoTrabajoFields: FormField[] = [
  { name: "fechaDesde", label: "Desde", type: "date" },
  { name: "fechaHasta", label: "Hasta", type: "date" },
  { name: "montoACobrar", label: "Monto a Cobrar", type: "number", placeholder: "0.00" },
  { name: "fechaEstimadaCobro", label: "Estimación de Cobro", type: "date" },
  { name: "fechaDeCobro", label: "Fecha de Cobro", type: "date" },
  { name: "nombreTrabajo", label: "Trabajo", type: "select", optionsFrom: fetchTrabajos },
];
