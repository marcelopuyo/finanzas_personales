// Cálculos compartidos de jornadas de trabajo. Módulo PURO (sin "use server"):
// lo usa `actions/movimientos.ts` (wizard de jornada/tarea y cobro) y el guard de
// modalidad de `actions/trabajos.ts`.
import type { Repository } from "typeorm";
import type { JornadaTrabajo } from "../entities/jornada-trabajo.entity";

/**
 * Convierte horas decimales (formato HH.MM, ej. 17.3 = 17:30) y devuelve el
 * monto de la jornada (horaHasta - horaDesde en horas × precioHora).
 */
export function calcularMontoJornada(
  horaDesde: number,
  horaHasta: number,
  precioHora: number
): number {
  const horaDesdeDecimal =
    ((horaDesde - Math.floor(horaDesde)) * 100) / 60 + Math.trunc(horaDesde);
  const horaHastaDecimal =
    ((horaHasta - Math.floor(horaHasta)) * 100) / 60 + Math.trunc(horaHasta);
  return (horaHastaDecimal - horaDesdeDecimal) * precioHora;
}

/**
 * Normaliza una fecha (string "YYYY-MM-DD" o Date de una columna `date`) a su
 * representación ISO "YYYY-MM-DD", segura para comparar en queries.
 */
function isoDate(v: Date | string): string {
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  return String(v).slice(0, 10);
}

/** Formatea "YYYY-MM-DD" a **dd-mm-aa** (formato único de la app). */
export function formatearFechaDMA(v: Date | string): string {
  const [y, m, d] = isoDate(v).split("-");
  return `${d}-${m}-${y.slice(-2)}`;
}

/** Formatea hora HH.MM (ej. 17.3 = 17:30) a "HH:MM" para mensajes al usuario. */
export function formatearHora(v: number): string {
  const h = Math.trunc(v);
  const m = Math.round((v - h) * 100);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Devuelve la primera jornada del mismo trabajo (no eliminada) que se
 * SUPERPONE en el MISMO DÍA y con horas [horaDesde, horaHasta] solapadas
 * (horaDesde < otra.horaHasta AND otra.horaDesde < horaHasta; las horas
 * contiguas, ej. 08:00-12:00 y 12:00-16:00, NO se consideran solapamiento).
 * `excluirId` permite ignorar la propia jornada al editar.
 *
 * ⚠️ El trabajo de la jornada se resuelve por **`jt.trabajoId`** (el vínculo
 * propio del ítem, modelo nuevo) y, para las jornadas viejas que no lo tienen,
 * cayendo a su **período** (`LEFT JOIN` + `COALESCE`). Antes se unía SÓLO al
 * período: desde que la jornada nace **pendiente** (sin período) el guard no
 * encontraba nada y dejaba cargar jornadas superpuestas.
 */
export async function encontrarJornadaSuperpuesta(
  repo: Repository<JornadaTrabajo>,
  trabajoId: number,
  fechaJornada: Date | string,
  horaDesde: number,
  horaHasta: number,
  excluirId?: string
): Promise<JornadaTrabajo | null> {
  const qb = repo
    .createQueryBuilder("jt")
    .leftJoin("periodo_trabajo", "pt", "pt.id = jt.periodoTrabajoId")
    .where("COALESCE(jt.trabajoId, pt.trabajoId) = :trabajoId", { trabajoId })
    // Una jornada pendiente no tiene período: sólo se descartan las que sí lo
    // tienen y está eliminado.
    .andWhere("(pt.id IS NULL OR pt.eliminado = :eliminadoPt)", {
      eliminadoPt: false,
    })
    .andWhere("jt.eliminado = :eliminado", { eliminado: false })
    .andWhere("jt.fechaJornada = :fecha", { fecha: isoDate(fechaJornada) })
    .andWhere("jt.horaDesde < :hasta", { hasta: horaHasta })
    .andWhere("jt.horaHasta > :desde", { desde: horaDesde })
    .orderBy("jt.horaDesde", "ASC")
    .limit(1);
  if (excluirId !== undefined) {
    qb.andWhere("jt.id <> :excluirId", { excluirId });
  }
  return qb.getOne();
}

// ===========================================================================
// Modalidades de cobro y tareas (2026-09-05)
// ===========================================================================

export type ModalidadCobro =
  | "fijo"
  | "horas_fijas"
  | "horas_variables"
  | "por_tarea";

export function modalidadAdmiteJornadas(m: string): boolean {
  return m === "horas_variables";
}

export function modalidadAdmiteTareas(m: string): boolean {
  return m === "por_tarea";
}

/** Etiqueta legible de una modalidad para mensajes al usuario. */
export function etiquetaModalidad(m: string): string {
  switch (m) {
    case "fijo":
      return "Monto fijo";
    case "horas_fijas":
      return "Horas fijas";
    case "por_tarea":
      return "Por tarea";
    case "horas_variables":
    default:
      return "Horas variables";
  }
}

/**
 * Lo que **ya no vive acá** (retirado en la refactor de liquidaciones):
 *  · el **prorrateo por mes** y el reconocimiento del **cobro adelantado** (§8 de
 *    `plan-remodelacion-trabajo.md`) ⇒ el criterio de ingresos es **único** y vive
 *    en el módulo puro `lib/ingresos-trabajo.ts` (P1.a.1);
 *  · `calcularMontoACobrar`, `calcularMontoTareas`,
 *    `calcularMontoACobrarPorModalidad`, `encontrarPeriodoSuperpuesto` y
 *    `fechaEnRango` ⇒ el monto de la liquidación lo arma `cobrarTrabajo` y la
 *    superposición de períodos dejó de existir (los CRUDs se archivaron).
 */

/** ¿El período ya fue cobrado (pagado)? Un cobro real deja `fechaDeCobro`
 *  con una fecha >= 1901-01-02; null o el centinela 1901-01-01 = pendiente.
 *  ⚠️ En el modelo nuevo una liquidación existe sólo si se **cobró**, así que
 *  para el panel/wizard el predicado es `tieneCobroReal` del módulo puro
 *  `lib/ingresos-trabajo.ts`; éste queda para el **guard de modalidad** de
 *  `actions/trabajos.ts` (redacta el mensaje según si ya se cobró). */
export function periodoCobrado(
  p: { fechaDeCobro?: Date | null } | null | undefined
): boolean {
  if (!p || !p.fechaDeCobro) return false;
  return isoDate(p.fechaDeCobro) >= "1901-01-02";
}
