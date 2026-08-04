import { z } from "zod";
import type { FormField } from "@/components/crud/CrudForm";
import { fetchPersonas, fetchTarjetas, fetchPeriodosTarjeta } from "../options";

export const movimientoTarjetaSchema = z.object({
  detalle: z.string().optional(),
  fecha: z.string().min(1, "Fecha requerida"),
  monto: z.coerce.number().positive("Debe ser positivo"),
  cuotas: z.coerce.number().positive("Debe ser positivo"),
  persona: z.string().min(1, "Seleccione una persona"),
  tarjeta: z.string().min(1, "Seleccione una tarjeta"),
  periodo: z.string().min(1, "Seleccione un período"),
});
export type MovimientoTarjetaFormData = z.infer<typeof movimientoTarjetaSchema>;

export const movimientoTarjetaFields: FormField[] = [
  { name: "detalle", label: "Detalle", type: "text", placeholder: "Opcional" },
  { name: "fecha", label: "Fecha", type: "date" },
  { name: "monto", label: "Monto", type: "number", placeholder: "0.00" },
  { name: "cuotas", label: "Cuotas", type: "number", placeholder: "1" },
  { name: "persona", label: "Persona", type: "select", optionsFrom: fetchPersonas },
  { name: "tarjeta", label: "Tarjeta", type: "select", optionsFrom: fetchTarjetas },
  { name: "periodo", label: "Período", type: "select", optionsFrom: fetchPeriodosTarjeta },
];
