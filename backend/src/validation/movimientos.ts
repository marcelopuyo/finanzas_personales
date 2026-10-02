import { z } from "zod";

// Reemplaza a class-validator. Reglas equivalentes a los DTOs del backend NestJS.

// Los presets de motivo viven en el módulo compartido `lib/motivos-transferencia.ts`
// (los usan la UI, la voz y el action `transferir`). Se re-exportan por compatibilidad.
export { MOTIVOS_TRANSFERENCIA } from "../../../lib/motivos-transferencia";

/**
 * Motivo de transferencia: un preset **o** un texto libre escrito por el usuario
 * (`plan-motivo-personalizado-transferencia.md`). Ya **no** es un enum candado:
 * el texto se guarda en `movimiento.motivo` y el concepto sólo aporta la
 * categoría (el signo). Máximo 60 caracteres (mismo tope que la columna).
 */
export const motivoTransferenciaSchema = z.string().trim().min(1).max(60);

const dateString = z.string().min(1);

// Movimiento tipo 1 — CobroSueldo / PagoPrestamo / AjusteCuenta / PagoGasto
export const movimiento1Schema = z.object({
  fecha: dateString,
  monto: z.number(),
  idCuenta: z.number(),
  idPeriodoTrabajo: z.number().optional(),
  idGasto: z.string().optional(),
  idPrestamo: z.string().optional(),
});

// Movimiento tipo 2 — Transferencia
export const movimiento2Schema = z.object({
  fecha: dateString,
  montoOrigen: z.number().optional(),
  idCuentaOrigen: z.number().optional(),
  montoDestino: z.number().optional(),
  idCuentaDestino: z.number().optional(),
  motivo: motivoTransferenciaSchema,
});

// Movimiento tipo 3 — GastoDirecto
export const movimiento3Schema = z.object({
  descripcion: z.string().min(1),
  fecha: dateString,
  monto: z.number(),
  idCuenta: z.number(),
  idCategoriaGasto: z.number(),
});

// Movimiento tipo 1-bis — **COBRAR TRABAJO**: crea la liquidación + el movimiento.
// La liquidación **nace y queda cerrada** en este acto (plan-liquidaciones.md): no
// tiene estado, no hay saldo ni "pago a cuenta"; guarda el **calculado** y el **cobrado**.
export const cobrarTrabajoSchema = z.object({
  fecha: dateString,
  idTrabajo: z.number(),
  idCuenta: z.number(),
  /** Monto **cobrado** (editable; viene precargado con el calculado). */
  monto: z.number(),
  /** Rango declarado (`fijo`/`horas_fijas`). En las variables se deriva de los ítems. */
  fechaDesde: dateString.optional(),
  fechaHasta: dateString.optional(),
  /** Horas del período (sólo `horas_fijas`): `montoCalculado = horas × precio`. */
  horasPeriodo: z.number().optional(),
  /** Jornadas pendientes a liquidar (modalidades por hora). */
  idsJornadas: z.array(z.string()).optional().default([]),
  /** Tareas pendientes a liquidar (modalidad `por_tarea`). */
  idsTareas: z.array(z.string()).optional().default([]),
});

// Movimiento tipo 4 — Jornada de trabajo desde el wizard.
// Crea la jornada (como el CRUD) y, si montoPropina > 0, la deposita en idCuenta.
// La jornada nace **pendiente de liquidar**: ya NO hay período que elegir
// (la liquidación se crea al cobrar, plan-liquidaciones.md).
export const jornadaStepperSchema = z.object({
  fecha: dateString,
  horaDesde: z.number(),
  horaHasta: z.number(),
  montoPropina: z.number().optional().default(0),
  /** Cuenta donde se deposita la propina (obligatoria si montoPropina > 0). */
  idCuenta: z.number().optional(),
  /** Trabajo al que pertenece la jornada (único vínculo). */
  idTrabajo: z.number(),
});

// Movimiento tipo 8 — Tarea de trabajo desde el wizard (modalidad `por_tarea`).
// SIN propina ni depósito. Igual que la jornada, la tarea nace **pendiente de
// liquidar**: no hay período que elegir (la liquidación se crea al cobrar).
export const tareaStepperSchema = z.object({
  /** Instante exacto de la tarea (ISO), para mostrar la hora. */
  fechaHoraTarea: z.string(),
  /** Fecha CALENDARIO LOCAL de la tarea (la que eligió el usuario). */
  fechaTarea: dateString,
  descripcion: z.string().optional(),
  /** Horas invertidas: opcional e **informativa** (no afecta el monto). */
  horasTarea: z.number().optional(),
  /** Monto ganado en la tarea (se carga a mano). */
  montoTarea: z.number(),
  /** Trabajo al que pertenece la tarea (único vínculo). */
  idTrabajo: z.number(),
});

// ---- EDICIÓN de ítems PENDIENTES (2026-09-26) ----
// Mismos campos que el alta MENOS el trabajo: al editar, un ítem no cambia de
// trabajo (y el action rechaza cualquier ítem ya liquidado: está "congelado").

/** Editar una jornada pendiente (`actualizarJornadaTrabajo`). */
export const editarJornadaSchema = z.object({
  fecha: dateString,
  /** Horas decimales del backend (`HH.MM`, ej. 17.3 = 17:30). */
  horaDesde: z.number(),
  horaHasta: z.number(),
  montoPropina: z.number().optional().default(0),
  /** Cuenta del depósito de propina (obligatoria si `montoPropina > 0`). */
  idCuenta: z.number().optional(),
});

/** Editar una tarea pendiente (`actualizarTareaTrabajo`). */
export const editarTareaSchema = z.object({
  fechaHoraTarea: z.string(),
  fechaTarea: dateString,
  descripcion: z.string().optional(),
  horasTarea: z.number().optional(),
  montoTarea: z.number(),
});
