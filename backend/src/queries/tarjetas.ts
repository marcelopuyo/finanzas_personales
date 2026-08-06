import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { MovimientoTarjeta } from "../entities/movimiento-tarjeta.entity";
import { PeriodoTarjeta } from "../entities/periodo-tarjeta.entity";
import { Tarjeta } from "../entities/tarjeta.entity";

// ============================================================
// Tipos de salida (coinciden con los Response DTOs del backend)
// ============================================================
export interface TarjetaOut {
  id: number;
  nombre: string;
  banco: string;
  numero: string;
  cuenta: { nombre: string } | null;
}

export interface PeriodoTarjetaOut {
  id: number;
  nombre: string;
  fechaApertura: Date;
  fechaCierre: Date;
  fechaVencimiento: Date;
  tarjeta: { nombre: string } | null;
}

export interface MovimientoTarjetaOut {
  id: string;
  detalle: string | null;
  fecha: Date;
  monto: number;
  cuotas: number;
  persona: { nombre: string } | null;
  tarjeta: { nombre: string } | null;
  periodo: { nombre: string } | null;
}

// ============================================================
// Tarjetas
// ============================================================
export async function getAllTarjetas(): Promise<TarjetaOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds
    .getRepository(Tarjeta)
    .find({ where: { usuario: { id: userId }, eliminado: false }, relations: { cuenta: true } });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    banco: r.banco,
    numero: r.numero,
    cuenta: r.cuenta ? { nombre: r.cuenta.nombre } : null,
  }));
}

export async function getTarjetaById(id: number): Promise<TarjetaOut | null> {
  const userId = await requireUserId();
  const ds = await getDb();
  const r = await ds
    .getRepository(Tarjeta)
    .findOne({ where: { id, usuario: { id: userId }, eliminado: false }, relations: { cuenta: true } });
  return r
    ? {
        id: r.id,
        nombre: r.nombre,
        banco: r.banco,
        numero: r.numero,
        cuenta: r.cuenta ? { nombre: r.cuenta.nombre } : null,
      }
    : null;
}

// ============================================================
// Períodos de tarjeta
// ============================================================
export async function getAllPeriodosTarjeta(): Promise<PeriodoTarjetaOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds
    .getRepository(PeriodoTarjeta)
    .find({ where: { tarjeta: { usuario: { id: userId } }, eliminado: false }, relations: { tarjeta: true } });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    fechaApertura: r.fechaApertura,
    fechaCierre: r.fechaCierre,
    fechaVencimiento: r.fechaVencimiento,
    tarjeta: r.tarjeta ? { nombre: r.tarjeta.nombre } : null,
  }));
}

export async function getPeriodoTarjetaById(
  id: number
): Promise<PeriodoTarjetaOut | null> {
  const userId = await requireUserId();
  const ds = await getDb();
  const r = await ds.getRepository(PeriodoTarjeta).findOne({
    where: { id, tarjeta: { usuario: { id: userId } }, eliminado: false },
    relations: { tarjeta: true },
  });
  return r
    ? {
        id: r.id,
        nombre: r.nombre,
        fechaApertura: r.fechaApertura,
        fechaCierre: r.fechaCierre,
        fechaVencimiento: r.fechaVencimiento,
        tarjeta: r.tarjeta ? { nombre: r.tarjeta.nombre } : null,
      }
    : null;
}

// ============================================================
// Movimientos de tarjeta
// ============================================================
export async function getAllMovimientosTarjeta(): Promise<MovimientoTarjetaOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(MovimientoTarjeta).find({
    where: { tarjeta: { usuario: { id: userId } }, eliminado: false },
    relations: { persona: true, tarjeta: true, periodo: true },
  });
  return rows.map((r) => ({
    id: r.id,
    detalle: r.detalle ?? null,
    fecha: r.fecha,
    monto: r.monto,
    cuotas: r.cuotas,
    persona: r.persona ? { nombre: r.persona.nombre } : null,
    tarjeta: r.tarjeta ? { nombre: r.tarjeta.nombre } : null,
    periodo: r.periodo ? { nombre: r.periodo.nombre } : null,
  }));
}

export async function getMovimientoTarjetaById(
  id: string
): Promise<MovimientoTarjetaOut | null> {
  const userId = await requireUserId();
  const ds = await getDb();
  const r = await ds.getRepository(MovimientoTarjeta).findOne({
    where: { id, tarjeta: { usuario: { id: userId } }, eliminado: false },
    relations: { persona: true, tarjeta: true, periodo: true },
  });
  return r
    ? {
        id: r.id,
        detalle: r.detalle ?? null,
        fecha: r.fecha,
        monto: r.monto,
        cuotas: r.cuotas,
        persona: r.persona ? { nombre: r.persona.nombre } : null,
        tarjeta: r.tarjeta ? { nombre: r.tarjeta.nombre } : null,
        periodo: r.periodo ? { nombre: r.periodo.nombre } : null,
      }
    : null;
}
