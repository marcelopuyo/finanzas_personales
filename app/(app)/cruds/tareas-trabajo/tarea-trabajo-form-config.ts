import { z } from "zod";
import type { FormField } from "@/components/crud/CrudForm";
import {
  fetchPeriodosTrabajoPorTarea,
  fetchTrabajosPorTareaId,
} from "../options";

// Tarea de un trabajo con modalidad 'por_tarea' (2026-09-05).
export const tareaTrabajoSchema = z
  .object({
    // "YYYY-MM-DDTHH:mm" (datetime-local). Se envía convertida a ISO (Z).
    fechaHoraTarea: z.string().min(1, "Fecha/hora requerida"),
    // Opcional, precargada con la fecha/hora y editable.
    descripcion: z.string().optional(),
    // Opcional INFORMATIVA (no afecta el monto).
    horasTarea: z.coerce.number().optional(),
    montoTarea: z.coerce.number().positive("El monto debe ser positivo"),
    // "auto" = crear período automático (período de una sola tarea).
    idPeriodo: z.string().min(1, "Seleccione un período"),
    idTrabajo: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.idPeriodo === "auto" && !data.idTrabajo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["idTrabajo"],
        message: "Seleccione el trabajo",
      });
    }
  });
export type TareaTrabajoFormData = z.infer<typeof tareaTrabajoSchema>;

const camposBase: FormField[] = [
  {
    name: "fechaHoraTarea",
    label: "Fecha y hora de la tarea",
    type: "datetime",
  },
  {
    name: "descripcion",
    label: "Descripción",
    type: "text",
    placeholder: "Ej. Logo para cliente X",
  },
  {
    name: "horasTarea",
    label: "Horas (informativas)",
    type: "number",
    placeholder: "0.00 (opcional, no afecta el monto)",
  },
  { name: "montoTarea", label: "Monto ganado", type: "number", placeholder: "0.00" },
];

// Para "Nueva Tarea": períodos de trabajos por_tarea + opción "auto" + trabajo.
export const tareaTrabajoFields: FormField[] = [
  ...camposBase,
  {
    name: "idPeriodo",
    label: "Período",
    type: "select",
    optionsFrom: fetchPeriodosTrabajoPorTarea,
    extraOptions: [{ value: "auto", label: "Cargar período automático" }],
  },
  {
    name: "idTrabajo",
    label: "Trabajo",
    type: "select",
    optionsFrom: fetchTrabajosPorTareaId,
    showIf: (v) => v.idPeriodo === "auto",
  },
];

// Para "Editar Tarea": solo períodos existentes (sin "auto").
export const tareaTrabajoFieldsEditar: FormField[] = [
  ...camposBase,
  {
    name: "idPeriodo",
    label: "Período",
    type: "select",
    optionsFrom: fetchPeriodosTrabajoPorTarea,
  },
];
