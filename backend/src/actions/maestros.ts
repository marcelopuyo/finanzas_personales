"use server";

import type { z } from "zod";
import { getDb } from "../db";
import { requireAdmin, requireUserId } from "../lib/auth";
import { dbError, refresh } from "../lib/action-helpers";
import { Concepto } from "../entities/concepto.entity";
import { Cuenta } from "../entities/cuenta.entity";
import { Inflacion } from "../entities/inflacion.entity";
import { Moneda } from "../entities/moneda.entity";
import { Persona } from "../entities/persona.entity";
import { TipoCuenta } from "../entities/tipo-cuenta.entity";
import {
  getConceptoById,
  getCuentaById,
  getInflacionById,
  getMonedaById,
  getPersonaById,
  getTipoCuentaById,
} from "../queries/maestros";
import {
  conceptoCreateSchema,
  conceptoUpdateSchema,
  cuentaCreateSchema,
  cuentaUpdateSchema,
  inflacionCreateSchema,
  inflacionUpdateSchema,
  monedaCreateSchema,
  monedaUpdateSchema,
  personaCreateSchema,
  personaUpdateSchema,
  tipoCuentaCreateSchema,
  tipoCuentaUpdateSchema,
} from "../validation/maestros";

// ============================================================
// CONCEPTO
// ============================================================
export async function crearConcepto(
  input: z.infer<typeof conceptoCreateSchema>
) {
  await requireAdmin();
  const data = conceptoCreateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(Concepto);
  try {
    const created = await repo.save(repo.create(data));
    refresh();
    return getConceptoById(created.id);
  } catch (error) {
    dbError(error, "Concepto");
  }
}

export async function actualizarConcepto(
  id: number,
  input: z.infer<typeof conceptoUpdateSchema>
) {
  await requireAdmin();
  const data = conceptoUpdateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(Concepto);
  // Solo admin puede editar (los conceptos son globales).
  const existing = await repo.findOne({ where: { id } });
  if (!existing) {
    throw new Error(`Concepto con id ${id} no encontrado`);
  }
  try {
    Object.assign(existing, data);
    await repo.save(existing);
    refresh();
    return getConceptoById(id);
  } catch (error) {
    dbError(error, "Concepto");
  }
}

export async function eliminarConcepto(id: number) {
  await requireAdmin();
  const ds = await getDb();
  const repo = ds.getRepository(Concepto);
  const row = await repo.findOne({
    where: { id, eliminado: false },
  });
  if (!row) {
    throw new Error(`Concepto con id ${id} no encontrado`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Concepto");
  }
}

// ============================================================
// TIPO DE CUENTA
// ============================================================
export async function crearTipoCuenta(
  input: z.infer<typeof tipoCuentaCreateSchema>
) {
  await requireAdmin();
  const data = tipoCuentaCreateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(TipoCuenta);
  try {
    const created = await repo.save(repo.create(data));
    refresh();
    return getTipoCuentaById(created.id);
  } catch (error) {
    dbError(error, "Tipo de cuenta");
  }
}

export async function actualizarTipoCuenta(
  id: number,
  input: z.infer<typeof tipoCuentaUpdateSchema>
) {
  await requireAdmin();
  const data = tipoCuentaUpdateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(TipoCuenta);
  const existing = await repo.preload({ id, ...data });
  if (!existing) {
    throw new Error(`Tipo de cuenta con id ${id} no encontrado`);
  }
  try {
    await repo.save(existing);
    refresh();
    return getTipoCuentaById(id);
  } catch (error) {
    dbError(error, "Tipo de cuenta");
  }
}

export async function eliminarTipoCuenta(id: number) {
  await requireAdmin();
  const ds = await getDb();
  const repo = ds.getRepository(TipoCuenta);
  const row = await repo.findOneBy({ id, eliminado: false });
  if (!row) {
    throw new Error(`Tipo de cuenta con id ${id} no encontrado`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Tipo de cuenta");
  }
}

// ============================================================
// MONEDA
// ============================================================
export async function crearMoneda(input: z.infer<typeof monedaCreateSchema>) {
  await requireAdmin();
  const data = monedaCreateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(Moneda);
  try {
    const created = await repo.save(repo.create(data));
    refresh();
    return getMonedaById(created.id);
  } catch (error) {
    dbError(error, "Moneda");
  }
}

export async function actualizarMoneda(
  id: number,
  input: z.infer<typeof monedaUpdateSchema>
) {
  await requireAdmin();
  const data = monedaUpdateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(Moneda);
  const existing = await repo.preload({ id, ...data });
  if (!existing) {
    throw new Error(`Moneda con id ${id} no encontrada`);
  }
  try {
    await repo.save(existing);
    refresh();
    return getMonedaById(id);
  } catch (error) {
    dbError(error, "Moneda");
  }
}

export async function eliminarMoneda(id: number) {
  await requireAdmin();
  const ds = await getDb();
  const repo = ds.getRepository(Moneda);
  const row = await repo.findOneBy({ id, eliminado: false });
  if (!row) {
    throw new Error(`Moneda con id ${id} no encontrada`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Moneda");
  }
}

// ============================================================
// PERSONA
// ============================================================
export async function crearPersona(input: z.infer<typeof personaCreateSchema>) {
  const userId = await requireUserId();
  const data = personaCreateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(Persona);
  try {
    const created = await repo.save(
      repo.create({ ...data, usuario: { id: userId } })
    );
    refresh();
    return getPersonaById(created.id);
  } catch (error) {
    dbError(error, "Persona");
  }
}

export async function actualizarPersona(
  id: number,
  input: z.infer<typeof personaUpdateSchema>
) {
  const userId = await requireUserId();
  const data = personaUpdateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(Persona);
  const existing = await repo.findOneBy({ id, usuario: { id: userId } });
  if (!existing) {
    throw new Error(`Persona con id ${id} no encontrada`);
  }
  try {
    Object.assign(existing, data);
    await repo.save(existing);
    refresh();
    return getPersonaById(id);
  } catch (error) {
    dbError(error, "Persona");
  }
}

export async function eliminarPersona(id: number) {
  const userId = await requireUserId();
  const ds = await getDb();
  const repo = ds.getRepository(Persona);
  const row = await repo.findOneBy({ id, usuario: { id: userId }, eliminado: false });
  if (!row) {
    throw new Error(`Persona con id ${id} no encontrada`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Persona");
  }
}

// ============================================================
// CUENTA (tipo y moneda se reciben por nombre)
// ============================================================
export async function crearCuenta(input: z.infer<typeof cuentaCreateSchema>) {
  const userId = await requireUserId();
  const data = cuentaCreateSchema.parse(input);
  const ds = await getDb();
  const { tipo, tarjeta, moneda, ...rest } = data;

  const tipoCuenta = await ds
    .getRepository(TipoCuenta)
    .findOneBy({ nombre: tipo, eliminado: false });
  if (!tipoCuenta) {
    throw new Error(`Tipo de cuenta con nombre "${tipo}" no encontrado`);
  }

  const monedaEntity = await ds
    .getRepository(Moneda)
    .findOneBy({ nombre: moneda, eliminado: false });
  if (!monedaEntity) {
    throw new Error(`Moneda con nombre "${moneda}" no encontrada`);
  }

  try {
    const repo = ds.getRepository(Cuenta);
    const created = await repo.save(
      repo.create({
        ...rest,
        tipo: tipoCuenta,
        moneda: monedaEntity,
        usuario: { id: userId },
      })
    );
    refresh();
    return getCuentaById(created.id);
  } catch (error) {
    dbError(error, "Cuenta");
  }
}

export async function actualizarCuenta(
  id: number,
  input: z.infer<typeof cuentaUpdateSchema>
) {
  const userId = await requireUserId();
  const data = cuentaUpdateSchema.parse(input);
  const ds = await getDb();
  const { tipo, tarjeta, moneda, incluirEnBalance, ...rest } = data;

  const existing = await ds
    .getRepository(Cuenta)
    .findOneBy({ id, usuario: { id: userId }, eliminado: false });
  if (!existing) {
    throw new Error(`Cuenta con id ${id} no encontrada`);
  }

  if (tipo) {
    const tipoCuenta = await ds
      .getRepository(TipoCuenta)
      .findOneBy({ nombre: tipo, eliminado: false });
    if (!tipoCuenta) {
      throw new Error(`Tipo de cuenta con nombre "${tipo}" no encontrado`);
    }
    existing.tipo = tipoCuenta;
  }

  if (moneda) {
    const monedaEntity = await ds
      .getRepository(Moneda)
      .findOneBy({ nombre: moneda, eliminado: false });
    if (!monedaEntity) {
      throw new Error(`Moneda con nombre "${moneda}" no encontrada`);
    }
    existing.moneda = monedaEntity;
  }

  // `incluirEnBalance` se aplica solo si viene definido (en edición el form
  // siempre lo envía; si un caller lo omite se conserva el valor actual).
  if (incluirEnBalance !== undefined) {
    existing.incluirEnBalance = incluirEnBalance;
  }

  try {
    Object.assign(existing, rest);
    await ds.getRepository(Cuenta).save(existing);
    refresh();
    return getCuentaById(id);
  } catch (error) {
    dbError(error, "Cuenta");
  }
}

export async function eliminarCuenta(id: number) {
  const userId = await requireUserId();
  const ds = await getDb();
  const repo = ds.getRepository(Cuenta);
  const row = await repo.findOneBy({ id, usuario: { id: userId }, eliminado: false });
  if (!row) {
    throw new Error(`Cuenta con id ${id} no encontrada`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Cuenta");
  }
}

// ============================================================
// ============================================================
// INFLACIÓN
// ============================================================
export async function crearInflacion(
  input: z.infer<typeof inflacionCreateSchema>
) {
  const userId = await requireUserId();
  const data = inflacionCreateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(Inflacion);
  try {
    const created = await repo.save(
      repo.create({ ...data, usuario: { id: userId } })
    );
    refresh();
    return getInflacionById(created.id);
  } catch (error) {
    dbError(error, "Inflación");
  }
}

export async function actualizarInflacion(
  id: number,
  input: z.infer<typeof inflacionUpdateSchema>
) {
  const userId = await requireUserId();
  const data = inflacionUpdateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(Inflacion);
  const existing = await repo.findOneBy({ id, usuario: { id: userId } });
  if (!existing) {
    throw new Error(`Inflación con id ${id} no encontrada`);
  }
  try {
    Object.assign(existing, data);
    await repo.save(existing);
    refresh();
    return getInflacionById(id);
  } catch (error) {
    dbError(error, "Inflación");
  }
}

export async function eliminarInflacion(id: number) {
  const userId = await requireUserId();
  const ds = await getDb();
  const repo = ds.getRepository(Inflacion);
  const row = await repo.findOneBy({ id, usuario: { id: userId }, eliminado: false });
  if (!row) {
    throw new Error(`Inflación con id ${id} no encontrada`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Inflación");
  }
}
