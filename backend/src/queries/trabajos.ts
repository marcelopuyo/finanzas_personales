import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { JornadaTrabajo } from "../entities/jornada-trabajo.entity";
import { Movimiento } from "../entities/movimiento.entity";
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
  precioHora: number;
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
    precioHora: r.precioHora ?? 0,
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
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds
    .getRepository(Trabajo)
    .find({ where: { usuario: { id: userId }, eliminado: false } });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    fechaInicio: r.fechaInicio,
    precioHora: r.precioHora,
    memos: r.memos ?? null,
  }));
}

export async function getTrabajoById(id: number): Promise<TrabajoOut | null> {
  const userId = await requireUserId();
  const ds = await getDb();
  const r = await ds
    .getRepository(Trabajo)
    .findOne({ where: { id, usuario: { id: userId }, eliminado: false } });
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
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(PeriodoTrabajo).find({
    where: { trabajo: { usuario: { id: userId } }, eliminado: false },
    // Más recientes primero (por la columna Desde).
    order: { fechaDesde: "DESC" },
    relations: { trabajo: true, jornadas: true },
  });
  return rows.map(mapPeriodo);
}

export async function getPeriodoTrabajoById(
  id: number
): Promise<PeriodoTrabajoOut | null> {
  const userId = await requireUserId();
  const ds = await getDb();
  const r = await ds.getRepository(PeriodoTrabajo).findOne({
    where: { id, trabajo: { usuario: { id: userId } }, eliminado: false },
    relations: { trabajo: true, jornadas: true },
  });
  return r ? mapPeriodo(r) : null;
}

// ============================================================
// Jornadas de trabajo
// ============================================================
export async function getAllJornadasTrabajo(): Promise<
  (JornadaTrabajoOut & {
    periodoTrabajo: { id: number; trabajo: string } | null;
    trabajo: string;
  })[]
> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(JornadaTrabajo).find({
    where: { periodoTrabajo: { trabajo: { usuario: { id: userId } } }, eliminado: false },
    relations: { periodoTrabajo: { trabajo: true } },
    order: { fechaJornada: "DESC", fechaCarga: "DESC" },
  });
  return rows.map((r) => ({
    ...mapJornada(r),
    periodoTrabajo: r.periodoTrabajo
      ? {
          id: r.periodoTrabajo.id,
          trabajo: r.periodoTrabajo.trabajo?.nombre ?? "Sin trabajo",
        }
      : null,
    // El dashboard usa `trabajo` como nombre del trabajo
    trabajo: r.periodoTrabajo?.trabajo?.nombre ?? "Sin trabajo",
  }));
}

export async function getJornadaTrabajoById(
  id: string
): Promise<
  (JornadaTrabajoOut & { periodoTrabajoId?: number; cuentaPropinaId?: number }) | null
> {
  const userId = await requireUserId();
  const ds = await getDb();
  const r = await ds.getRepository(JornadaTrabajo).findOne({
    where: { id, periodoTrabajo: { trabajo: { usuario: { id: userId } } }, eliminado: false },
    relations: { periodoTrabajo: true },
  });
  if (!r) return null;
  // Cuenta donde se depositó la propina (movimiento "Cobro Propina" vinculado
  // a la jornada). Se usa para preseleccionar el select al editar.
  const mov = await ds.getRepository(Movimiento).findOne({
    where: { jornadaTrabajo: { id }, eliminado: false },
    relations: { cuenta: true },
    order: { fecha: "DESC" },
  });
  return {
    ...mapJornada(r),
    periodoTrabajoId: r.periodoTrabajo?.id,
    cuentaPropinaId: mov?.cuenta?.id ?? undefined,
  };
}
