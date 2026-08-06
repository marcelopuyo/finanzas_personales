import { z } from "zod";
import type { FormField } from "@/components/crud/CrudForm";
import { fetchTarjetas } from "../options";

export const periodoTarjetaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  fechaApertura: z.string().min(1, "Fecha requerida"),
  fechaCierre: z.string().min(1, "Fecha requerida"),
  fechaVencimiento: z.string().min(1, "Fecha requerida"),
  tarjeta: z.string().min(1, "Seleccione una tarjeta"),
});
export type PeriodoTarjetaFormData = z.infer<typeof periodoTarjetaSchema>;

export const periodoTarjetaFields: FormField[] = [
  { name: "nombre", label: "Nombre", type: "text", placeholder: "Ej. Agosto 26" },
  { name: "fechaApertura", label: "Fecha Apertura", type: "date" },
  { name: "fechaCierre", label: "Fecha Cierre", type: "date" },
  { name: "fechaVencimiento", label: "Fecha Vencimiento", type: "date" },
  { name: "tarjeta", label: "Tarjeta", type: "select", optionsFrom: fetchTarjetas },
];
