import { LessThanOrEqual, MoreThan, MoreThanOrEqual } from "typeorm";
import { getDb } from "../db";
import { CategoriaGasto } from "../entities/categoria-gasto.entity";
import { Gasto } from "../entities/gasto.entity";
import { PeriodoGasto } from "../entities/periodo-gasto.entity";

// ============================================================
// Tipos de salida (coinciden con los Response DTOs del backend)
// ============================================================
export interface CategoriaGastoOut {
  id: number;
  nombre: string;
}

export interface PeriodoGastoOut {
  id: number;
  nombre: string;
  fechaApertura: Date;
  fechaCierre: Date;
}

export interface GastoOut {
  id: string;
  descripcion: string | null;
  monto: number;
  saldo: number;
  fechaVencimiento: Date | null;
  fechaPago: Date | null;
  isPeriodico: boolean;
  categoria: { nombre: string } | null;
  periodo: { nombre: string } | null;
  cuenta: null;
}

// ============================================================
// Categorías de gasto
// ============================================================
export async function getAllCategoriasGasto(): Promise<CategoriaGastoOut[]> {
  const ds = await getDb();
  const rows = await ds
    .getRepository(CategoriaGasto)
    .find({ where: { eliminado: false } });
  return rows.map((r) => ({ id: r.id, nombre: r.nombre }));
}

export async function getCategoriaGastoById(
  id: number
): Promise<CategoriaGastoOut | null> {
  const ds = await getDb();
  const r = await ds
    .getRepository(CategoriaGasto)
    .findOne({ where: { id, eliminado: false } });
  return r ? { id: r.id, nombre: r.nombre } : null;
}

// ============================================================
// Períodos de gasto
// ============================================================
export async function getAllPeriodosGasto(): Promise<PeriodoGastoOut[]> {
  const ds = await getDb();
  const rows = await ds
    .getRepository(PeriodoGasto)
    .find({ where: { eliminado: false } });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    fechaApertura: r.fechaApertura,
    fechaCierre: r.fechaCierre,
  }));
}

export async function getPeriodoGastoById(
  id: number
): Promise<PeriodoGastoOut | null> {
  const ds = await getDb();
  const r = await ds
    .getRepository(PeriodoGasto)
    .findOne({ where: { id, eliminado: false } });
  return r
    ? {
        id: r.id,
        nombre: r.nombre,
        fechaApertura: r.fechaApertura,
        fechaCierre: r.fechaCierre,
      }
    : null;
}

export async function getPeriodoGastoActual(): Promise<PeriodoGastoOut | null> {
  const ds = await getDb();
  const now = new Date();
  const r = await ds.getRepository(PeriodoGasto).findOne({
    where: {
      eliminado: false,
      fechaApertura: LessThanOrEqual(now),
      fechaCierre: MoreThanOrEqual(now),
    },
  });
  return r
    ? {
        id: r.id,
        nombre: r.nombre,
        fechaApertura: r.fechaApertura,
        fechaCierre: r.fechaCierre,
      }
    : null;
}

// ============================================================
// Gastos (relaciones periodo y categoria)
// ============================================================
function mapGasto(r: Gasto): GastoOut {
  return {
    id: r.id,
    descripcion: r.descripcion ?? null,
    monto: r.monto,
    saldo: r.saldo,
    fechaVencimiento: r.fechaVencimiento ?? null,
    fechaPago: r.fechaPago ?? null,
    isPeriodico: r.isPeriodico,
    categoria: r.categoria ? { nombre: r.categoria.nombre } : null,
    periodo: r.periodo ? { nombre: r.periodo.nombre } : null,
    cuenta: null,
  };
}

export async function getAllGastos(): Promise<GastoOut[]> {
  const ds = await getDb();
  const rows = await ds.getRepository(Gasto).find({
    where: { eliminado: false },
    relations: { periodo: true, categoria: true },
  });
  return rows.map(mapGasto);
}

export async function getGastosPendientes(): Promise<GastoOut[]> {
  const ds = await getDb();
  const rows = await ds.getRepository(Gasto).find({
    where: { eliminado: false, saldo: MoreThan(0) },
    relations: { periodo: true, categoria: true },
  });
  return rows.map(mapGasto);
}

export async function getGastoById(id: string): Promise<GastoOut | null> {
  const ds = await getDb();
  const r = await ds.getRepository(Gasto).findOne({
    where: { id, eliminado: false },
    relations: { periodo: true, categoria: true },
  });
  return r ? mapGasto(r) : null;
}
