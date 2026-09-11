import { z } from "zod";
import type { FormField } from "@/components/crud/CrudForm";
import { fetchPersonas, fetchCuentas } from "../options";
import { personaQuickCreate } from "../persona-quick-create";
import { labelContraparte } from "@/lib/prestamos";

export const prestamoSchema = z.object({
  detalle: z.string().optional(),
  fecha: z.string().min(1, "Fecha requerida"),
  monto: z.coerce.number().positive("Debe ser positivo"),
  sentido: z.enum(["otorgado", "obtenido"], { errorMap: () => ({ message: "Seleccione un sentido" }) }),
  // Una sola persona: la CONTRAPARTE (la otra parte es el usuario).
  personaContraparte: z.string().min(1, "Seleccione una persona"),
  cuenta: z.string().min(1, "Seleccione una cuenta"),
});
export type PrestamoFormData = z.infer<typeof prestamoSchema>;

export const prestamoFields: FormField[] = [
  { name: "detalle", label: "Detalle", type: "text", placeholder: "Opcional" },
  { name: "fecha", label: "Fecha", type: "date" },
  { name: "monto", label: "Monto", type: "number", placeholder: "0.00" },
  {
    name: "sentido",
    label: "Sentido",
    type: "select",
    options: [
      { value: "otorgado", label: "Otorgado (yo presto)" },
      { value: "obtenido", label: "Recibido (me prestan)" },
    ],
  },
  {
    // La contraparte: quién es depende del sentido del préstamo.
    name: "personaContraparte",
    label: (values) => labelContraparte(String(values?.sentido ?? "otorgado")),
    hint: "La otra parte sos vos.",
    type: "combobox",
    optionsFrom: fetchPersonas,
    quickCreate: personaQuickCreate,
  },
  { name: "cuenta", label: "Cuenta", type: "select", optionsFrom: fetchCuentas },
];
