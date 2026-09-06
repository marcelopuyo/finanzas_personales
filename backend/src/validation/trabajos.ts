import { z } from "zod";

// Reemplaza a class-validator. Reglas equivalentes a los DTOs del backend NestJS.

const dateString = z.string().min(1);
// Fecha/hora efectiva de una tarea: "YYYY-MM-DDTHH:mm[:ss]" (datetime-local).
const dateTimeString = z.string().min(1);

// Modalidades de cobro de un trabajo (2026-09-04/05):
//  - fijo:           monto por período, se carga junto con el período.
//  - horas_fijas:    horas por período × precio por hora (snapshot).
//  - horas_variables: jornadas (horas cargadas) × precio por hora + propina.
//  - por_tarea:      cada tarea se carga con su propio monto (no por hora).
export const MODALIDADES_COBRO = [
  "fijo",
  "horas_fijas",
  "horas_variables",
  "por_tarea",
] as const;
export type ModalidadCobro = (typeof MODALIDADES_COBRO)[number];

// ---- Trabajo ----
// `precioHora` es requerido SOLO para las modalidades por hora. En el CREATE,
// si no llega modalidad se asume 'horas_variables' (comportamiento histórico,
// exigía precio). En el UPDATE solo se exige cuando la modalidad viene explícita.
const trabajoBase = z.object({
  nombre: z.string().min(1),
  fechaInicio: dateString,
  modalidadCobro: z.enum(MODALIDADES_COBRO).optional(),
  precioHora: z.number().positive().optional(),
  memos: z.string().optional(),
});

const requierePrecioSiPorHora = (
  val: {
    modalidadCobro?: (typeof MODALIDADES_COBRO)[number];
    precioHora?: number;
  },
  ctx: z.RefinementCtx,
  defaultSiAusente: boolean
) => {
  const modalidad =
    val.modalidadCobro ?? (defaultSiAusente ? "horas_variables" : undefined);
  if (!modalidad) return;
  if (
    (modalidad === "horas_fijas" || modalidad === "horas_variables") &&
    (val.precioHora === undefined || val.precioHora <= 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["precioHora"],
      message: "Indicá el precio por hora para esta modalidad",
    });
  }
};

export const trabajoCreateSchema = trabajoBase.superRefine((val, ctx) =>
  requierePrecioSiPorHora(val, ctx, true)
);
export const trabajoUpdateSchema = trabajoBase
  .partial()
  .superRefine((val, ctx) => requierePrecioSiPorHora(val, ctx, false));

// ---- Período de trabajo ----
export const periodoTrabajoCreateSchema = z.object({
  fechaDesde: dateString,
  fechaHasta: dateString,
  // Modalidad 'fijo': monto cargado junto con el período.
  montoACobrar: z.number().optional(),
  // Modalidad 'horas_fijas': horas del período (el sistema calcula el monto).
  horasPeriodo: z.number().optional(),
  fechaEstimadaCobro: dateString.optional(),
  fechaDeCobro: dateString.optional(),
  nombreTrabajo: z.string().min(1), // nombre del trabajo
});
export const periodoTrabajoUpdateSchema = periodoTrabajoCreateSchema.partial();

// ---- Jornada de trabajo ----
export const jornadaTrabajoCreateSchema = z.object({
  fechaJornada: dateString,
  horaDesde: z.number(),
  horaHasta: z.number(),
  montoPropina: z.number().optional().default(0),
  // idPeriodo es opcional: si llega crearPeriodoAutomatico = true se crea un
  // período de una sola jornada (fechaDesde = fechaHasta = fecha) y NO se usa
  // un período existente.
  idPeriodo: z.number().optional(),
  crearPeriodoAutomatico: z.boolean().optional().default(false),
  idTrabajo: z.number().optional(),
  // Cuenta donde se deposita la propina (requerida si montoPropina > 0).
  idCuenta: z.number().optional(),
});
export const jornadaTrabajoUpdateSchema = jornadaTrabajoCreateSchema.partial();

// ---- Tarea de trabajo (modalidad 'por_tarea') ----
export const tareaTrabajoCreateSchema = z.object({
  // Fecha/hora efectiva de la tarea (la carga el usuario).
  fechaHoraTarea: dateTimeString,
  // Fecha CALENDARIO LOCAL de la tarea ("YYYY-MM-DD", la que ve el usuario en
  // el input). Se usa para agrupar/validar por la fecha local (decisión
  // 2026-09-05); el instante exacto queda en fechaHoraTarea.
  fechaTarea: dateString,
  // Opcional, precargada con la fecha/hora y editable.
  descripcion: z.string().optional(),
  // Opcional INFORMATIVA (no afecta el monto).
  horasTarea: z.number().positive().optional(),
  // Monto ganado en la tarea (obligatorio > 0).
  montoTarea: z.number().positive(),
  // idPeriodo es opcional: si llega crearPeriodoAutomatico = true se crea un
  // período de una sola tarea (fechaDesde = fechaHasta = fecha de la tarea).
  idPeriodo: z.number().optional(),
  crearPeriodoAutomatico: z.boolean().optional().default(false),
  idTrabajo: z.number().optional(),
});
export const tareaTrabajoUpdateSchema = tareaTrabajoCreateSchema.partial();
