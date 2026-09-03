import { z } from "zod";
import type { FormField } from "@/components/crud/CrudForm";
import { fetchPersonas, fetchCuentas } from "../options";

export const prestamoSchema = z.object({
  detalle: z.string().optional(),
  fecha: z.string().min(1, "Fecha requerida"),
  monto: z.coerce.number().positive("Debe ser positivo"),
  cuotas: z.coerce.number().positive("Debe ser positivo"),
  sentido: z.enum(["otorgado", "obtenido"], { errorMap: () => ({ message: "Seleccione un sentido" }) }),
  personaOrigen: z.string().min(1, "Seleccione una persona"),
  personaDestino: z.string().min(1, "Seleccione una persona"),
  cuenta: z.string().min(1, "Seleccione una cuenta"),
});
export type PrestamoFormData = z.infer<typeof prestamoSchema>;

export const prestamoFields: FormField[] = [
  { name: "detalle", label: "Detalle", type: "text", placeholder: "Opcional" },
  { name: "fecha", label: "Fecha", type: "date" },
  { name: "monto", label: "Monto", type: "number", placeholder: "0.00" },
  { name: "cuotas", label: "Cuotas", type: "number", placeholder: "1" },
  { name: "sentido", label: "Sentido", type: "select", options: [{ value: "otorgado", label: "Otorgado" }, { value: "obtenido", label: "Recibido" }] },
  { name: "personaOrigen", label: "Prestador", type: "select", optionsFrom: fetchPersonas },
  { name: "personaDestino", label: "Destinatario", type: "select", optionsFrom: fetchPersonas },
  { name: "cuenta", label: "Cuenta", type: "select", optionsFrom: fetchCuentas },
];
