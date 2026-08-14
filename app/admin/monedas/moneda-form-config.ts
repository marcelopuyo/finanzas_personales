import { z } from "zod";

export const monedaSchema = z.object({
  simbolo: z.string().min(1, "El símbolo es requerido"),
  nombre: z.string().min(1, "El nombre es requerido"),
  codigoISO: z.string().min(1, "El código ISO es requerido"),
  // Código del país para la bandera (ej. "ar", "us", "eu"); vacío = sin bandera.
  codigoPais: z.string().max(2).optional(),
});

export type MonedaFormData = z.infer<typeof monedaSchema>;

export const monedaFields = [
  { name: "nombre", label: "Nombre", type: "text" as const, placeholder: "Ej. Peso Argentino" },
  { name: "simbolo", label: "Símbolo", type: "text" as const, placeholder: "Ej. $" },
  { name: "codigoISO", label: "Código ISO", type: "text" as const, placeholder: "Ej. ARS" },
  { name: "codigoPais", label: "País (bandera)", type: "text" as const, placeholder: "Ej. ar, us, eu (vacío = sin bandera)" },
];
