import { In, LessThanOrEqual, MoreThan, MoreThanOrEqual } from "typeorm";
import { getDb } from "../db";
import { CategoriaGasto } from "../entities/categoria-gasto.entity";
import { Gasto } from "../entities/gasto.entity";
import { Movimiento } from "../entities/movimiento.entity";
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
  /** Cuenta con la que se pagó el gasto (desde el Movimiento). */
  cuenta: string | null;
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

/**
 * Resuelve la cuenta con la que se pagó cada gasto en una sola consulta.
 * Devuelve un mapa idGasto → nombreCuenta.
 */
async function resolveCuentas(
  ds: Awaited<ReturnType<typeof getDb>>,
  gastoIds: string[]
): Promise<Map<string, string>> {
  if (gastoIds.length === 0) return new Map();
  const movimientos = await ds.getRepository(Movimiento).find({
    where: { gasto: { id: In(gastoIds) }, eliminado: false },
    relations: { cuenta: true, gasto: true },
  });
  const map = new Map<string, string>();
  for (const mov of movimientos) {
    if (mov.gasto?.id && mov.cuenta?.nombre) {
      map.set(mov.gasto.id, mov.cuenta.nombre);
    }
  }
  return map;
}

function withCuenta(row: GastoOut, cuentaMap: Map<string, string>): GastoOut {
  return { ...row, cuenta: cuentaMap.get(row.id) ?? null };
}

export async function getAllGastos(): Promise<GastoOut[]> {
  const ds = await getDb();
  const rows = await ds.getRepository(Gasto).find({
    where: { eliminado: false },
    relations: { periodo: true, categoria: true },
  });
  const mapped = rows.map(mapGasto);
  const cuentas = await resolveCuentas(ds, mapped.map((g) => g.id));
  return mapped.map((g) => withCuenta(g, cuentas));
}

export async function getGastosPendientes(): Promise<GastoOut[]> {
  const ds = await getDb();
  const rows = await ds.getRepository(Gasto).find({
    where: { eliminado: false, saldo: MoreThan(0) },
    relations: { periodo: true, categoria: true },
  });
  const mapped = rows.map(mapGasto);
  const cuentas = await resolveCuentas(ds, mapped.map((g) => g.id));
  return mapped.map((g) => withCuenta(g, cuentas));
}

export async function getGastoById(id: string): Promise<GastoOut | null> {
  const ds = await getDb();
  const r = await ds.getRepository(Gasto).findOne({
    where: { id, eliminado: false },
    relations: { periodo: true, categoria: true },
  });
  if (!r) return null;
  const mapped = mapGasto(r);
  const cuentas = await resolveCuentas(ds, [mapped.id]);
  return withCuenta(mapped, cuentas);
}

/**
 * Busca descripciones de gastos guardados (no eliminados) que contengan el
 * término, devolviendo valores únicos. Se usa para autocompletar el campo
 * "Descripción" del Gasto Directo.
 */
export async function buscarDescripcionesGasto(
  termino: string
): Promise<string[]> {
  const ds = await getDb();
  const rows = await ds
    .getRepository(Gasto)
    .createQueryBuilder("g")
    .select("g.descripcion", "descripcion")
    .where("g.descripcion LIKE :termino", { termino: `%${termino}%` })
    .andWhere("g.eliminado = :eliminado", { eliminado: false })
    .andWhere("g.descripcion IS NOT NULL")
    .orderBy("g.descripcion", "ASC")
    .limit(50)
    .getRawMany();

  const unicos = new Set<string>();
  for (const r of rows) {
    const d = r?.descripcion;
    if (typeof d === "string" && d.trim().length > 0) unicos.add(d.trim());
  }
  return Array.from(unicos).slice(0, 8);
}

