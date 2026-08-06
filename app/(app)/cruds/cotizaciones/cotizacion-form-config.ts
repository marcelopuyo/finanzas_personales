import { z } from "zod";
import type { FormField } from "@/components/crud/CrudForm";
import { fetchMonedas } from "../options";

export const cotizacionSchema = z.object({
  fechaInicial: z.string().min(1, "Fecha requerida"),
  fechaFinal: z.string().min(1, "Fecha requerida"),
  cotizacion: z.coerce.number().positive("Debe ser positivo"),
  moneda: z.string().min(1, "Seleccione una moneda"),
});
export type CotizacionFormData = z.infer<typeof cotizacionSchema>;

export const cotizacionFields: FormField[] = [
  { name: "fechaInicial", label: "Fecha Inicial", type: "date" },
  { name: "fechaFinal", label: "Fecha Final", type: "date" },
  { name: "cotizacion", label: "Cotización", type: "number", placeholder: "0.00" },
  { name: "moneda", label: "Moneda", type: "select", optionsFrom: fetchMonedas },
];
