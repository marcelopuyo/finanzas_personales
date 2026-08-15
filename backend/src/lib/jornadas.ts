// Cálculos compartidos de jornadas de trabajo. Módulo PURO (sin "use server"):
// lo usan actions/trabajos (CRUD) y actions/movimientos (wizard).
import type { Repository } from "typeorm";
import type { PeriodoTrabajo } from "../entities/periodo-trabajo.entity";
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
 * Suma el monto a cobrar de un período a partir de sus jornadas NO eliminadas.
 * IMPORTANTE (decisión 2026-08-06): la propina NO se incluye. Las tarjetas
 * "Períodos a Cobrar" / "Períodos Actuales" del dashboard no contabilizan la
 * propina; la propina se deposita aparte en una cuenta (wizard "Jornada trabajo").
 */
export function calcularMontoACobrar(
  jornadas: { eliminado: boolean; montoJornada: number }[]
): number {
  let total = 0;
  for (const jornada of jornadas) {
    if (!jornada.eliminado) {
      total += jornada.montoJornada;
    }
  }
  return total;
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

/** Formatea "YYYY-MM-DD" a "dd-mm-aaaa" para mensajes al usuario. */
export function formatearFechaDMA(v: Date | string): string {
  const [y, m, d] = isoDate(v).split("-");
  return `${d}-${m}-${y}`;
}

/** ¿Está la fecha dentro del rango [desde, hasta]? (formato ISO YYYY-MM-DD). */
export function fechaEnRango(
  fecha: Date | string,
  desde: Date | string,
  hasta: Date | string
): boolean {
  const f = isoDate(fecha);
  return f >= isoDate(desde) && f <= isoDate(hasta);
}

/**
 * Devuelve el primer período de trabajo del mismo trabajo (no eliminado) que se
 * SUPERPONE con el rango [fechaDesde, fechaHasta]. `excluirId` permite ignorar
 * un período (al editar). Acepta un repo del DataSource o del manager de una
 * transacción. Usa SOLO columnas (pt.trabajoId, pt.fechaDesde, ...) sin joins,
 * para no depender de la carga de relaciones.
 */
export async function encontrarPeriodoSuperpuesto(
  repo: Repository<PeriodoTrabajo>,
  trabajoId: number,
  fechaDesde: Date | string,
  fechaHasta: Date | string,
  excluirId?: number
): Promise<PeriodoTrabajo | null> {
  const qb = repo
    .createQueryBuilder("pt")
    .where("pt.trabajoId = :trabajoId", { trabajoId })
    .andWhere("pt.eliminado = :eliminado", { eliminado: false })
    .andWhere("pt.fechaDesde <= :hasta", { hasta: isoDate(fechaHasta) })
    .andWhere("pt.fechaHasta >= :desde", { desde: isoDate(fechaDesde) })
    .orderBy("pt.fechaDesde", "ASC")
    .limit(1);
  if (excluirId !== undefined) {
    qb.andWhere("pt.id <> :excluirId", { excluirId });
  }
  return qb.getOne();
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
    .innerJoin("periodo_trabajo", "pt", "pt.id = jt.periodoTrabajoId")
    .where("pt.trabajoId = :trabajoId", { trabajoId })
    .andWhere("pt.eliminado = :eliminadoPt", { eliminadoPt: false })
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
