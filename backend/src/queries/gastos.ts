import { In, MoreThan } from "typeorm";
import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { CategoriaGasto } from "../entities/categoria-gasto.entity";
import { Gasto } from "../entities/gasto.entity";
import { Movimiento } from "../entities/movimiento.entity";

// ============================================================
// Tipos de salida (coinciden con los Response DTOs del backend)
// ============================================================
export interface CategoriaGastoOut {
  id: number;
  nombre: string;
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
  /** Cuenta con la que se pagó el gasto (desde el Movimiento). */
  cuenta: string | null;
}

// ============================================================
// Categorías de gasto
// ============================================================
export async function getAllCategoriasGasto(): Promise<CategoriaGastoOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds
    .getRepository(CategoriaGasto)
    .find({ where: { usuario: { id: userId }, eliminado: false } });
  return rows.map((r) => ({ id: r.id, nombre: r.nombre }));
}

export async function getCategoriaGastoById(
  id: number
): Promise<CategoriaGastoOut | null> {
  const userId = await requireUserId();
  const ds = await getDb();
  const r = await ds.getRepository(CategoriaGasto).findOne({
    where: { id, usuario: { id: userId }, eliminado: false },
  });
  return r ? { id: r.id, nombre: r.nombre } : null;
}

// ============================================================
// Gastos (relaciones categoria)
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
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(Gasto).find({
    where: { usuario: { id: userId }, eliminado: false },
    relations: { categoria: true },
    // Más recientes primero (por fecha de pago).
    order: { fechaPago: "DESC" },
  });
  const mapped = rows.map(mapGasto);
  const cuentas = await resolveCuentas(ds, mapped.map((g) => g.id));
  return mapped.map((g) => withCuenta(g, cuentas));
}

export async function getGastosPendientes(): Promise<GastoOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(Gasto).find({
    where: { usuario: { id: userId }, eliminado: false, saldo: MoreThan(0) },
    relations: { categoria: true },
  });
  const mapped = rows.map(mapGasto);
  const cuentas = await resolveCuentas(ds, mapped.map((g) => g.id));
  return mapped.map((g) => withCuenta(g, cuentas));
}

export async function getGastoById(id: string): Promise<GastoOut | null> {
  const userId = await requireUserId();
  const ds = await getDb();
  const r = await ds.getRepository(Gasto).findOne({
    where: { id, usuario: { id: userId }, eliminado: false },
    relations: { categoria: true },
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
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds
    .getRepository(Gasto)
    .createQueryBuilder("g")
    .select("g.descripcion", "descripcion")
    .where("g.descripcion LIKE :termino", { termino: `%${termino}%` })
    .andWhere("g.eliminado = :eliminado", { eliminado: false })
    .andWhere('g."usuarioId" = :userId', { userId })
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

/** Último gasto con una descripción exacta (para precargar categoría y monto). */
export interface UltimoGastoOut {
  descripcion: string;
  categoriaId: number | null;
  categoriaNombre: string | null;
  /** Monto guardado tal cual (siempre en la MONEDA PREDETERMINADA del usuario). */
  monto: number;
}

/**
 * Gasto MÁS RECIENTE con esa descripción exacta (no eliminado, del usuario
 * autenticado). "Más reciente" = fechaPago DESC y, si está vacía, por
 * fechaVencimiento DESC (no hay columna de fecha de alta: la fecha de pago es
 * la que define el orden histórico de gastos).
 *
 * Lo usa el autocompletar del Gasto Directo al elegir una sugerencia.
 */
export async function getUltimoGastoPorDescripcion(
  descripcion: string
): Promise<UltimoGastoOut | null> {
  const userId = await requireUserId();
  const ds = await getDb();
  const r = await ds
    .getRepository(Gasto)
    .createQueryBuilder("g")
    .leftJoinAndSelect("g.categoria", "categoria")
    .where("g.descripcion = :descripcion", { descripcion })
    .andWhere("g.eliminado = :eliminado", { eliminado: false })
    .andWhere('g."usuarioId" = :userId', { userId })
    .orderBy("g.fechaPago", "DESC", "NULLS LAST")
    .addOrderBy("g.fechaVencimiento", "DESC", "NULLS LAST")
    .getOne();
  if (!r) return null;
  return {
    descripcion: r.descripcion,
    categoriaId: r.categoria?.id ?? null,
    categoriaNombre: r.categoria?.nombre ?? null,
    monto: Number(r.monto),
  };
}

