import { z } from "zod";
import type { FormField } from "@/components/crud/CrudForm";
import { fetchPeriodosTrabajo, fetchTrabajosId } from "../options";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const jornadaTrabajoSchema = z
  .object({
    fechaJornada: z.string().min(1, "Fecha requerida"),
    horaDesde: z.string().regex(timeRegex, "Hora inválida (HH:MM)"),
    horaHasta: z.string().regex(timeRegex, "Hora inválida (HH:MM)"),
    montoPropina: z.coerce.number().optional(),
    // "auto" = crear período automático (período de una sola jornada);
    // un número (string) = id del período existente seleccionado.
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
export type JornadaTrabajoFormData = z.infer<typeof jornadaTrabajoSchema>;

const camposBase: FormField[] = [
  { name: "fechaJornada", label: "Fecha Jornada", type: "date" },
  { name: "horaDesde", label: "Hora Desde", type: "time" },
  { name: "horaHasta", label: "Hora Hasta", type: "time" },
  { name: "montoPropina", label: "Propina", type: "number", placeholder: "0.00" },
];

// Para "Nueva Jornada": el select de período incluye la opción
// "Cargar período automático" y, al elegirla, aparece el select de Trabajo.
export const jornadaTrabajoFields: FormField[] = [
  ...camposBase,
  {
    name: "idPeriodo",
    label: "Período",
    type: "select",
    optionsFrom: fetchPeriodosTrabajo,
    extraOptions: [{ value: "auto", label: "Cargar período automático" }],
  },
  {
    name: "idTrabajo",
    label: "Trabajo",
    type: "select",
    optionsFrom: fetchTrabajosId,
    showIf: (v) => v.idPeriodo === "auto",
  },
];

// Para "Editar Jornada": solo períodos existentes (sin "auto").
export const jornadaTrabajoFieldsEditar: FormField[] = [
  ...camposBase,
  {
    name: "idPeriodo",
    label: "Período",
    type: "select",
    optionsFrom: fetchPeriodosTrabajo,
  },
];
