import { z } from "zod";
import type { FormField } from "@/components/crud/CrudForm";
import { crearCategoriaGasto } from "@/backend/src/actions/gastos";
import { fetchCategoriasGasto } from "./helpers";

/** Esquema zod para crear/editar Gasto */
export const gastoSchema = z.object({
  descripcion: z.string().optional(),
  monto: z.coerce.number().min(1, "El monto es requerido"),
  saldo: z.coerce.number().min(0, "El saldo no puede ser negativo"),
  fechaVencimiento: z.string().optional(),
  fechaPago: z.string().optional(),
  categoria: z.string().min(1, "Seleccione una categoría"),
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
    type: "combobox",
    optionsFrom: fetchCategoriasGasto,
    // Alta rápida (opción A): crear la categoría desde acá mismo, sin salir del
    // formulario (así no se pierde el resto de lo cargado). El gasto guarda la
    // categoría por NOMBRE (`nombreCategoria`), así que la opción nueva va con
    // value = label = nombre.
    quickCreate: {
      label: "Nueva categoría",
      title: "Nueva categoría de gasto",
      placeholder: "Ej. Supermercado",
      create: async (nombre) => {
        const creada = await crearCategoriaGasto({ nombre });
        if (!creada) throw new Error("No se pudo crear la categoría");
        return { value: creada.nombre, label: creada.nombre };
      },
    },
  },
];
