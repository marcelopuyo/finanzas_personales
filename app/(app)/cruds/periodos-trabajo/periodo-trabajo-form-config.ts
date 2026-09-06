import { z } from "zod";
import type { FormField } from "@/components/crud/CrudForm";
import { fetchTrabajos } from "../options";

export const periodoTrabajoSchema = z.object({
  fechaDesde: z.string().min(1, "Fecha requerida"),
  fechaHasta: z.string().min(1, "Fecha requerida"),
  // Modalidad 'fijo': monto cargado junto con el período.
  montoACobrar: z.coerce.number().optional(),
  // Modalidad 'horas_fijas': horas del período (el sistema calcula el monto).
  horasPeriodo: z.coerce.number().optional(),
  fechaEstimadaCobro: z.string().optional(),
  fechaDeCobro: z.string().optional(),
  nombreTrabajo: z.string().min(1, "Seleccione un trabajo"),
});
export type PeriodoTrabajoFormData = z.infer<typeof periodoTrabajoSchema>;

const campoMonto: FormField = {
  name: "montoACobrar",
  label: "Monto del período",
  type: "number",
  placeholder: "0.00",
};
const campoHoras: FormField = {
  name: "horasPeriodo",
  label: "Horas del período",
  type: "number",
  placeholder: "0.00",
};

/**
 * Campos de EDICIÓN de un período según la modalidad del trabajo (§7.2):
 *  - fijo           → se edita el monto.
 *  - horas_fijas    → se editan las horas (el sistema recalcula con el snapshot).
 *  - horas_variables/por_tarea → como hoy: permite editar el monto (override
 *    manual; el valor por defecto viene de jornadas/tareas).
 */
export function periodoTrabajoFieldsEditar(
  modalidad?: string
): FormField[] {
  const m = modalidad ?? "horas_variables";
  const valorField =
    m === "horas_fijas" ? campoHoras : m === "fijo" ? campoMonto : campoMonto;
  return [
    { name: "fechaDesde", label: "Desde", type: "date" },
    { name: "fechaHasta", label: "Hasta", type: "date" },
    valorField,
    { name: "fechaEstimadaCobro", label: "Estimación de Cobro", type: "date" },
    { name: "fechaDeCobro", label: "Fecha de Cobro", type: "date" },
    { name: "nombreTrabajo", label: "Trabajo", type: "select", optionsFrom: fetchTrabajos },
  ];
}

// Campos del ALTA clásico (sin elegir trabajo previo). Hoy el alta usa un
// flujo por modalidad (`NuevoPeriodoDeTrabajo`), donde el campo de valor
// (monto u horas) depende del trabajo elegido.
export const periodoTrabajoFieldsNuevo: FormField[] = [
  { name: "fechaDesde", label: "Desde", type: "date" },
  { name: "fechaHasta", label: "Hasta", type: "date" },
  { name: "fechaEstimadaCobro", label: "Estimación de Cobro", type: "date" },
  { name: "nombreTrabajo", label: "Trabajo", type: "select", optionsFrom: fetchTrabajos },
];
