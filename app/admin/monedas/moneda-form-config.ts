import { z } from "zod";

export const monedaSchema = z.object({
  simbolo: z.string().min(1, "El símbolo es requerido"),
  nombre: z.string().min(1, "El nombre es requerido"),
  codigoISO: z.string().min(1, "El código ISO es requerido"),
});

export type MonedaFormData = z.infer<typeof monedaSchema>;

export const monedaFields = [
  { name: "nombre", label: "Nombre", type: "text" as const, placeholder: "Ej. Peso Argentino" },
  { name: "simbolo", label: "Símbolo", type: "text" as const, placeholder: "Ej. $" },
  { name: "codigoISO", label: "Código ISO", type: "text" as const, placeholder: "Ej. ARS" },
];
