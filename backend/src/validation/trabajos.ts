import { z } from "zod";

// Reemplaza a class-validator. Reglas equivalentes a los DTOs del backend NestJS.

const dateString = z.string().min(1);

// Modalidades de cobro de un trabajo (2026-09-04/05):
//  - fijo:            monto por período, declarado al cobrar.
//  - horas_fijas:     horas del período × precio por hora (snapshot al cobrar).
//  - horas_variables: jornadas cargadas (la propina va aparte, por su depósito).
//  - por_tarea:       cada tarea se carga con su propio monto (no por hora).
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
//
// ⚠️ Acá vivían los schemas de **período, jornada y tarea** del circuito viejo
// (CRUDs archivados en `archivo/` con el rediseño de liquidaciones): la jornada y
// la tarea ahora se cargan desde el wizard, con sus propios schemas en
// `validation/movimientos.ts` (`jornadaStepperSchema` / `tareaStepperSchema`).
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
