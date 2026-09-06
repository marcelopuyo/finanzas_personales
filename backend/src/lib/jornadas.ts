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
 * "Por cobrar" / "Actuales" del dashboard no contabilizan la
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

/** Solo 'fijo' / 'horas_fijas' se prorratean por mes (períodos SIN hijos). */
export function modalidadProrratea(m: string): boolean {
  return m === "fijo" || m === "horas_fijas";
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

/** Suma el monto a cobrar de un período a partir de sus tareas NO eliminadas. */
export function calcularMontoTareas(
  tareas: { eliminado: boolean; montoTarea: number }[]
): number {
  let total = 0;
  for (const tarea of tareas) {
    if (!tarea.eliminado) {
      total += tarea.montoTarea;
    }
  }
  return total;
}

/**
 * Calcula el `montoACobrar` de un período según la modalidad de su trabajo:
 *  - fijo           → `montoCargado` (lo que se cargó junto con el período).
 *  - horas_fijas    → `horasPeriodo × precioHoraPeriodo` (snapshot).
 *  - horas_variables→ suma de jornadas (`calcularMontoACobrar`).
 *  - por_tarea      → suma de tareas (`calcularMontoTareas`).
 */
export function calcularMontoACobrarPorModalidad(params: {
  modalidad: string;
  montoCargado?: number;
  horasPeriodo?: number;
  precioHoraPeriodo?: number;
  jornadas?: { eliminado: boolean; montoJornada: number }[];
  tareas?: { eliminado: boolean; montoTarea: number }[];
}): number {
  switch (params.modalidad) {
    case "fijo":
      return params.montoCargado ?? 0;
    case "horas_fijas":
      return (params.horasPeriodo ?? 0) * (params.precioHoraPeriodo ?? 0);
    case "por_tarea":
      return params.tareas ? calcularMontoTareas(params.tareas) : 0;
    case "horas_variables":
    default:
      return params.jornadas ? calcularMontoACobrar(params.jornadas) : 0;
  }
}

/**
 * Normaliza una fecha/hora (Date o string ISO con o sin zona) a su parte de
 * FECHA "YYYY-MM-DD" (componentes UTC). NOTA (2026-09-05): para las TAREAS ya
 * no se usa esta función — la agrupación/validación usa la `fechaTarea` (fecha
 * LOCAL persistida como `date`). Se mantiene por compatibilidad.
 */
export function isoFechaHora(v: Date | string): string {
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) {
    return String(v).slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

/**
 * ¿Cae la fecha/hora efectiva dentro del rango [desde, hasta]? Compara la
 * FECHA (UTC) contra el rango. NOTA (2026-09-05): para TAREAS se prefiere
 * `fechaEnRango(fechaTarea, ...)` (fecha local persistida), sin corrimiento
 * de zona. Se mantiene por compatibilidad.
 */
export function fechaHoraEnRango(
  fechaHora: Date | string,
  desde: Date | string,
  hasta: Date | string
): boolean {
  const f = isoFechaHora(fechaHora);
  return f >= isoDate(desde) && f <= isoDate(hasta);
}

/**
 * Prorrateo de un período contra un mes calendario (§8 del plan).
 * devuelve el APORTE del período al mes [inicioMes, finMes]:
 *   aporte = monto × (días de P dentro del mes / días totales de P)
 * Las fechas se pasan como "YYYY-MM-DD" (comparables como string).
 */
export function aporteProrrateado(
  desde: Date | string,
  hasta: Date | string,
  monto: number,
  inicioMes: string,
  finMes: string
): number {
  const desdeStr = isoDate(desde);
  const hastaStr = isoDate(hasta);
  const totalDias = diffDias(desdeStr, hastaStr) + 1;
  if (totalDias <= 0 || monto <= 0) return 0;
  const ini = desdeStr > inicioMes ? desdeStr : inicioMes;
  const fin = hastaStr < finMes ? hastaStr : finMes;
  const dentro = diffDias(ini, fin) + 1;
  if (dentro <= 0) return 0;
  return (monto * dentro) / totalDias;
}

/** Días de diferencia entre dos "YYYY-MM-DD" (desde restado a hasta). */
function diffDias(desde: string, hasta: string): number {
  const d1 = Date.parse(`${desde}T00:00:00Z`);
  const d2 = Date.parse(`${hasta}T00:00:00Z`);
  return Math.round((d2 - d1) / 86400000);
}
