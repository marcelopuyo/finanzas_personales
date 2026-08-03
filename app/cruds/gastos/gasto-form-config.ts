import { z } from "zod";
import type { FormField } from "@/components/crud/CrudForm";
import { getAllCategoriasGasto } from "@/lib/api/endpoints/maestros.api";
import { getAllPeriodosGasto } from "@/lib/api/endpoints/gastos.api";

/** Esquema zod para crear/editar Gasto */
export const gastoSchema = z.object({
  descripcion: z.string().optional(),
  monto: z.coerce.number().min(1, "El monto es requerido"),
  saldo: z.coerce.number().min(0, "El saldo no puede ser negativo"),
  fechaVencimiento: z.string().optional(),
  fechaPago: z.string().optional(),
  categoria: z.string().min(1, "Seleccione una categoría"),
  periodo: z.string().min(1, "Seleccione un período"),
});

export type GastoFormData = z.infer<typeof gastoSchema>;

/** Definición de campos del formulario */
export const gastoFields: FormField[] = [
  {
    name: "descripcion",
    label: "Descripción",
    type: "text",
    placeholder: "Ej. Supermercado",
  },
  {
    name: "monto",
    label: "Monto",
    type: "number",
    placeholder: "0.00",
  },
  {
    name: "saldo",
    label: "Saldo",
    type: "number",
    placeholder: "0.00",
  },
  {
    name: "fechaVencimiento",
    label: "Fecha Vencimiento",
    type: "date",
  },
  {
    name: "fechaPago",
    label: "Fecha Pago",
    type: "date",
  },
  {
    name: "categoria",
    label: "Categoría",
    type: "select",
    optionsFrom: async () => {
      const categorias = await getAllCategoriasGasto();
      return categorias.map((c) => ({ value: c.nombre, label: c.nombre }));
    },
  },
  {
    name: "periodo",
    label: "Período",
    type: "select",
    optionsFrom: async () => {
      const periodos = await getAllPeriodosGasto();
      return periodos.map((p) => ({ value: p.nombre, label: p.nombre }));
    },
  },
];
