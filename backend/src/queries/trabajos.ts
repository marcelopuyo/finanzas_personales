import { getDb } from "../db";
import { JornadaTrabajo } from "../entities/jornada-trabajo.entity";
import { PeriodoTrabajo } from "../entities/periodo-trabajo.entity";
import { Trabajo } from "../entities/trabajo.entity";

// ============================================================
// Tipos de salida (coinciden con los Response DTOs del backend)
// ============================================================
export interface TrabajoOut {
  id: number;
  nombre: string;
  fechaInicio: Date;
  precioHora: number;
  memos: string | null;
}

export interface JornadaTrabajoOut {
  id: string;
  fechaJornada: Date;
  fechaCarga: Date;
  horaDesde: number;
  horaHasta: number;
  montoJornada: number;
  montoPropina: number;
}

export interface PeriodoTrabajoOut {
  id: number;
  fechaDesde: Date;
  fechaHasta: Date;
  montoACobrar: number | null;
  fechaEstimadaCobro: Date | null;
  fechaDeCobro: Date | null;
  trabajo: { nombre: string } | null;
  jornadas: JornadaTrabajoOut[];
}

function mapJornada(r: JornadaTrabajo): JornadaTrabajoOut {
  return {
    id: r.id,
    fechaJornada: r.fechaJornada,
    fechaCarga: r.fechaCarga,
    horaDesde: r.horaDesde,
    horaHasta: r.horaHasta,
    montoJornada: r.montoJornada,
    montoPropina: r.montoPropina ?? 0,
  };
}

function mapPeriodo(r: PeriodoTrabajo): PeriodoTrabajoOut {
  return {
    id: r.id,
    fechaDesde: r.fechaDesde,
    fechaHasta: r.fechaHasta,
    montoACobrar: r.montoACobrar ?? null,
    fechaEstimadaCobro: r.fechaEstimadaCobro ?? null,
    fechaDeCobro: r.fechaDeCobro ?? null,
    trabajo: r.trabajo ? { nombre: r.trabajo.nombre } : null,
    jornadas: (r.jornadas ?? [])
      .filter((j) => !j.eliminado)
      .map(mapJornada),
  };
}

// ============================================================
// Trabajos
// ============================================================
export async function getAllTrabajos(): Promise<TrabajoOut[]> {
  const ds = await getDb();
  const rows = await ds
    .getRepository(Trabajo)
    .find({ where: { eliminado: false } });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    fechaInicio: r.fechaInicio,
    precioHora: r.precioHora,
    memos: r.memos ?? null,
  }));
}

export async function getTrabajoById(id: number): Promise<TrabajoOut | null> {
  const ds = await getDb();
  const r = await ds
    .getRepository(Trabajo)
    .findOne({ where: { id, eliminado: false } });
  return r
    ? {
        id: r.id,
        nombre: r.nombre,
        fechaInicio: r.fechaInicio,
        precioHora: r.precioHora,
        memos: r.memos ?? null,
      }
    : null;
}

// ============================================================
// Períodos de trabajo (con trabajo y jornadas)
// ============================================================
export async function getAllPeriodosTrabajo(): Promise<PeriodoTrabajoOut[]> {
  const ds = await getDb();
  const rows = await ds.getRepository(PeriodoTrabajo).find({
    where: { eliminado: false },
    order: { fechaDesde: "ASC" },
    relations: { trabajo: true, jornadas: true },
  });
  return rows.map(mapPeriodo);
}

export async function getPeriodoTrabajoById(
  id: number
): Promise<PeriodoTrabajoOut | null> {
  const ds = await getDb();
  const r = await ds.getRepository(PeriodoTrabajo).findOne({
    where: { id, eliminado: false },
    relations: { trabajo: true, jornadas: true },
  });
  return r ? mapPeriodo(r) : null;
}

// ============================================================
// Jornadas de trabajo
// ============================================================
export async function getAllJornadasTrabajo(): Promise<
  (JornadaTrabajoOut & { periodoTrabajo: { id: number } | null })[]
> {
  const ds = await getDb();
  const rows = await ds.getRepository(JornadaTrabajo).find({
    where: { eliminado: false },
    relations: { periodoTrabajo: true },
  });
  return rows.map((r) => ({
    ...mapJornada(r),
    periodoTrabajo: r.periodoTrabajo
      ? { id: r.periodoTrabajo.id }
      : null,
  }));
}

export async function getJornadaTrabajoById(
  id: string
): Promise<JornadaTrabajoOut | null> {
  const ds = await getDb();
  const r = await ds
    .getRepository(JornadaTrabajo)
    .findOne({ where: { id, eliminado: false } });
  return r ? mapJornada(r) : null;
}
