import { z } from "zod";
import type { FormField } from "@/components/crud/CrudForm";
import { fetchTiposCuenta, fetchMonedas } from "../options";

export const cuentaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  saldo: z.coerce.number().min(0, "El saldo no puede ser negativo"),
  tipo: z.string().min(1, "Seleccione un tipo"),
  moneda: z.string().min(1, "Seleccione una moneda"),
});
export type CuentaFormData = z.infer<typeof cuentaSchema>;

export const cuentaFields: FormField[] = [
  { name: "nombre", label: "Nombre", type: "text", placeholder: "Ej. Cuenta Galicia $" },
  { name: "saldo", label: "Saldo", type: "number", placeholder: "0.00" },
  { name: "tipo", label: "Tipo", type: "select", optionsFrom: fetchTiposCuenta },
  { name: "moneda", label: "Moneda", type: "select", optionsFrom: fetchMonedas },
];
