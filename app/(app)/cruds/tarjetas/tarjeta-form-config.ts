import { z } from "zod";
import type { FormField } from "@/components/crud/CrudForm";
import { fetchCuentas } from "../options";

export const tarjetaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  banco: z.string().min(1, "El banco es requerido"),
  numero: z.string().min(1, "El número es requerido"),
  cuenta: z.string().min(1, "Seleccione una cuenta"),
});
export type TarjetaFormData = z.infer<typeof tarjetaSchema>;

export const tarjetaFields: FormField[] = [
  { name: "nombre", label: "Nombre", type: "text", placeholder: "Ej. Visa Galicia" },
  { name: "banco", label: "Banco", type: "text", placeholder: "Ej. Galicia" },
  { name: "numero", label: "Número", type: "text", placeholder: "XXXX-XXXX-XXXX-XXXX" },
  { name: "cuenta", label: "Cuenta", type: "select", optionsFrom: fetchCuentas },
];
