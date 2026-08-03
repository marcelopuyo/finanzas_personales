"use server";

import type { z } from "zod";
import { getDb } from "../db";
import { CategoriaGasto } from "../entities/categoria-gasto.entity";
import { Gasto } from "../entities/gasto.entity";
import { PeriodoGasto } from "../entities/periodo-gasto.entity";
import { dbError, refresh } from "../lib/action-helpers";
import {
  getCategoriaGastoById,
  getGastoById,
  getPeriodoGastoById,
} from "../queries/gastos";
import {
  categoriaGastoCreateSchema,
  categoriaGastoUpdateSchema,
  gastoCreateSchema,
  gastoUpdateSchema,
  periodoGastoCreateSchema,
  periodoGastoUpdateSchema,
} from "../validation/gastos";

// ============================================================
// CATEGORÍA DE GASTO
// ============================================================
export async function crearCategoriaGasto(
  input: z.infer<typeof categoriaGastoCreateSchema>
) {
  const data = categoriaGastoCreateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(CategoriaGasto);
  try {
    const created = await repo.save(repo.create(data));
    refresh();
    return getCategoriaGastoById(created.id);
  } catch (error) {
    dbError(error, "Categoría de gasto");
  }
}

export async function actualizarCategoriaGasto(
  id: number,
  input: z.infer<typeof categoriaGastoUpdateSchema>
) {
  const data = categoriaGastoUpdateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(CategoriaGasto);
  const existing = await repo.preload({ id, ...data });
  if (!existing) {
    throw new Error(`Categoría de gasto con id ${id} no encontrada`);
  }
  try {
    await repo.save(existing);
    refresh();
    return getCategoriaGastoById(id);
  } catch (error) {
    dbError(error, "Categoría de gasto");
  }
}

export async function eliminarCategoriaGasto(id: number) {
  const ds = await getDb();
  const repo = ds.getRepository(CategoriaGasto);
  const row = await repo.findOneBy({ id, eliminado: false });
  if (!row) {
    throw new Error(`Categoría de gasto con id ${id} no encontrada`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Categoría de gasto");
  }
}

// ============================================================
// PERÍODO DE GASTO
// ============================================================
export async function crearPeriodoGasto(
  input: z.infer<typeof periodoGastoCreateSchema>
) {
  const data = periodoGastoCreateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(PeriodoGasto);
  try {
    const created = await repo.save(repo.create(data));
    refresh();
    return getPeriodoGastoById(created.id);
  } catch (error) {
    dbError(error, "Período de gasto");
  }
}

export async function actualizarPeriodoGasto(
  id: number,
  input: z.infer<typeof periodoGastoUpdateSchema>
) {
  const data = periodoGastoUpdateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(PeriodoGasto);
  const existing = await repo.preload({ id, ...data });
  if (!existing) {
    throw new Error(`Período de gasto con id ${id} no encontrado`);
  }
  try {
    await repo.save(existing);
    refresh();
    return getPeriodoGastoById(id);
  } catch (error) {
    dbError(error, "Período de gasto");
  }
}

export async function eliminarPeriodoGasto(id: number) {
  const ds = await getDb();
  const repo = ds.getRepository(PeriodoGasto);
  const row = await repo.findOneBy({ id, eliminado: false });
  if (!row) {
    throw new Error(`Período de gasto con id ${id} no encontrado`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Período de gasto");
  }
}

// ============================================================
// GASTO (periodo y categoria por nombre)
// ============================================================
export async function crearGasto(input: z.infer<typeof gastoCreateSchema>) {
  const data = gastoCreateSchema.parse(input);
  const ds = await getDb();
  const { nombrePeriodo, nombreCategoria, ...rest } = data;

  const periodo = await ds
    .getRepository(PeriodoGasto)
    .findOneBy({ nombre: nombrePeriodo });
  if (!periodo) {
    throw new Error(`Período con nombre "${nombrePeriodo}" no encontrado`);
  }

  const categoria = await ds
    .getRepository(CategoriaGasto)
    .findOneBy({ nombre: nombreCategoria });
  if (!categoria) {
    throw new Error(`Categoría con nombre "${nombreCategoria}" no encontrada`);
  }

  try {
    const repo = ds.getRepository(Gasto);
    const created = await repo.save(
      repo.create({ ...rest, saldo: rest.monto, periodo, categoria })
    );
    refresh();
    return getGastoById(created.id);
  } catch (error) {
    dbError(error, "Gasto");
  }
}

export async function actualizarGasto(
  id: string,
  input: z.infer<typeof gastoUpdateSchema>
) {
  const data = gastoUpdateSchema.parse(input);
  const ds = await getDb();
  const { nombrePeriodo, nombreCategoria, ...rest } = data;

  const existing = await ds
    .getRepository(Gasto)
    .findOneBy({ id, eliminado: false });
  if (!existing) {
    throw new Error(`Gasto con id ${id} no encontrado`);
  }

  if (nombrePeriodo) {
    const periodo = await ds
      .getRepository(PeriodoGasto)
      .findOneBy({ nombre: nombrePeriodo });
    if (!periodo) {
      throw new Error(`Período con nombre "${nombrePeriodo}" no encontrado`);
    }
    existing.periodo = periodo;
  }

  if (nombreCategoria) {
    const categoria = await ds
      .getRepository(CategoriaGasto)
      .findOneBy({ nombre: nombreCategoria });
    if (!categoria) {
      throw new Error(`Categoría con nombre "${nombreCategoria}" no encontrada`);
    }
    existing.categoria = categoria;
  }

  try {
    Object.assign(existing, rest);
    await ds.getRepository(Gasto).save(existing);
    refresh();
    return getGastoById(id);
  } catch (error) {
    dbError(error, "Gasto");
  }
}

export async function eliminarGasto(id: string) {
  const ds = await getDb();
  const repo = ds.getRepository(Gasto);
  const row = await repo.findOneBy({ id, eliminado: false });
  if (!row) {
    throw new Error(`Gasto con id ${id} no encontrado`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Gasto");
  }
}
