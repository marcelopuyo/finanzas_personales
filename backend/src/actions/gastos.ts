"use server";

import type { z } from "zod";
import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { CategoriaGasto } from "../entities/categoria-gasto.entity";
import { Cuenta } from "../entities/cuenta.entity";
import { Gasto } from "../entities/gasto.entity";
import { Movimiento } from "../entities/movimiento.entity";
import { PeriodoGasto } from "../entities/periodo-gasto.entity";
import { crearHistoricoCuenta, dbError, refresh } from "../lib/action-helpers";
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
  const userId = await requireUserId();
  const data = categoriaGastoCreateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(CategoriaGasto);
  try {
    const created = await repo.save(
      repo.create({ ...data, usuario: { id: userId } })
    );
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
  const userId = await requireUserId();
  const data = categoriaGastoUpdateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(CategoriaGasto);
  const existing = await repo.findOneBy({ id, usuario: { id: userId } });
  if (!existing) {
    throw new Error(`Categoría de gasto con id ${id} no encontrada`);
  }
  try {
    Object.assign(existing, data);
    await repo.save(existing);
    refresh();
    return getCategoriaGastoById(id);
  } catch (error) {
    dbError(error, "Categoría de gasto");
  }
}

export async function eliminarCategoriaGasto(id: number) {
  const userId = await requireUserId();
  const ds = await getDb();
  const repo = ds.getRepository(CategoriaGasto);
  const row = await repo.findOneBy({ id, usuario: { id: userId }, eliminado: false });
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
  const userId = await requireUserId();
  const data = periodoGastoCreateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(PeriodoGasto);
  try {
    const created = await repo.save(
      repo.create({ ...data, usuario: { id: userId } })
    );
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
  const userId = await requireUserId();
  const data = periodoGastoUpdateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(PeriodoGasto);
  const existing = await repo.findOneBy({ id, usuario: { id: userId } });
  if (!existing) {
    throw new Error(`Período de gasto con id ${id} no encontrado`);
  }
  try {
    Object.assign(existing, data);
    await repo.save(existing);
    refresh();
    return getPeriodoGastoById(id);
  } catch (error) {
    dbError(error, "Período de gasto");
  }
}

export async function eliminarPeriodoGasto(id: number) {
  const userId = await requireUserId();
  const ds = await getDb();
  const repo = ds.getRepository(PeriodoGasto);
  const row = await repo.findOneBy({ id, usuario: { id: userId }, eliminado: false });
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
  const userId = await requireUserId();
  const data = gastoCreateSchema.parse(input);
  const ds = await getDb();
  const { nombrePeriodo, nombreCategoria, ...rest } = data;

  const periodo = await ds.getRepository(PeriodoGasto).findOneBy({
    nombre: nombrePeriodo,
    usuario: { id: userId },
  });
  if (!periodo) {
    throw new Error(`Período con nombre "${nombrePeriodo}" no encontrado`);
  }

  const categoria = await ds.getRepository(CategoriaGasto).findOneBy({
    nombre: nombreCategoria,
    usuario: { id: userId },
  });
  if (!categoria) {
    throw new Error(`Categoría con nombre "${nombreCategoria}" no encontrada`);
  }

  try {
    const repo = ds.getRepository(Gasto);
    const created = await repo.save(
      repo.create({
        ...rest,
        saldo: rest.monto,
        periodo,
        categoria,
        usuario: { id: userId },
      })
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
  const userId = await requireUserId();
  const data = gastoUpdateSchema.parse(input);
  const ds = await getDb();
  const { nombrePeriodo, nombreCategoria, ...rest } = data;

  const existing = await ds
    .getRepository(Gasto)
    .findOneBy({ id, usuario: { id: userId }, eliminado: false });
  if (!existing) {
    throw new Error(`Gasto con id ${id} no encontrado`);
  }

  if (nombrePeriodo) {
    const periodo = await ds.getRepository(PeriodoGasto).findOneBy({
      nombre: nombrePeriodo,
      usuario: { id: userId },
    });
    if (!periodo) {
      throw new Error(`Período con nombre "${nombrePeriodo}" no encontrado`);
    }
    existing.periodo = periodo;
  }

  if (nombreCategoria) {
    const categoria = await ds.getRepository(CategoriaGasto).findOneBy({
      nombre: nombreCategoria,
      usuario: { id: userId },
    });
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
  const userId = await requireUserId();
  const ds = await getDb();
  await ds.transaction(async (manager) => {
    const gastoRepo = manager.getRepository(Gasto);
    const movRepo = manager.getRepository(Movimiento);
    const cuentaRepo = manager.getRepository(Cuenta);

    const gasto = await gastoRepo.findOne({
      where: { id, usuario: { id: userId }, eliminado: false },
    });
    if (!gasto) throw new Error(`Gasto con id ${id} no encontrado`);

    // Buscar todos los movimientos de pago vinculados a este gasto
    const movimientos = await movRepo.find({
      where: { gasto: { id }, eliminado: false },
      relations: { cuenta: true },
    });

    // Revertir cada movimiento: devolver el monto a la cuenta y soft-delete
    for (const mov of movimientos) {
      const cuenta = mov.cuenta;
      if (cuenta) {
        cuenta.saldo += mov.monto;
        await cuentaRepo.save(cuenta);
        await crearHistoricoCuenta(manager, cuenta);
      }
      mov.eliminado = true;
      await movRepo.save(mov);
    }

    // Soft-delete del gasto
    gasto.eliminado = true;
    await gastoRepo.save(gasto);
  });

  refresh();
}
