"use server";

import type { z } from "zod";
import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { dbError, refresh } from "../lib/action-helpers";
import { Concepto } from "../entities/concepto.entity";
import { Cotizacion } from "../entities/cotizacion.entity";
import { Cuenta } from "../entities/cuenta.entity";
import { Inflacion } from "../entities/inflacion.entity";
import { Moneda } from "../entities/moneda.entity";
import { Persona } from "../entities/persona.entity";
import { TipoCuenta } from "../entities/tipo-cuenta.entity";
import {
  getConceptoById,
  getCotizacionById,
  getCuentaById,
  getInflacionById,
  getMonedaById,
  getPersonaById,
  getTipoCuentaById,
} from "../queries/maestros";
import {
  conceptoCreateSchema,
  conceptoUpdateSchema,
  cotizacionCreateSchema,
  cotizacionUpdateSchema,
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
  const userId = await requireUserId();
  const data = conceptoCreateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(Concepto);
  try {
    // Los conceptos nuevos son del usuario (nunca del sistema).
    const created = await repo.save(
      repo.create({ ...data, sistema: false, usuario: { id: userId } })
    );
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
  const userId = await requireUserId();
  const data = conceptoUpdateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(Concepto);
  // Solo el dueño puede editar; los del sistema están protegidos.
  const existing = await repo.findOne({
    where: [
      { id, usuario: { id: userId } },
      { id, sistema: true },
    ],
  });
  if (!existing) {
    throw new Error(`Concepto con id ${id} no encontrado`);
  }
  if (existing.sistema) {
    throw new Error("Los conceptos del sistema no se pueden modificar");
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
  const userId = await requireUserId();
  const ds = await getDb();
  const repo = ds.getRepository(Concepto);
  const row = await repo.findOne({
    where: [
      { id, usuario: { id: userId }, eliminado: false },
      { id, sistema: true, eliminado: false },
    ],
  });
  if (!row) {
    throw new Error(`Concepto con id ${id} no encontrado`);
  }
  if (row.sistema) {
    throw new Error("Los conceptos del sistema no se pueden eliminar");
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
  const { tipo, tarjeta, moneda, ...rest } = data;

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
// COTIZACIÓN (moneda por nombre)
// ============================================================
export async function crearCotizacion(
  input: z.infer<typeof cotizacionCreateSchema>
) {
  const userId = await requireUserId();
  const data = cotizacionCreateSchema.parse(input);
  const ds = await getDb();

  const monedaEntity = await ds
    .getRepository(Moneda)
    .findOneBy({ nombre: data.moneda, eliminado: false });
  if (!monedaEntity) {
    throw new Error(`Moneda con nombre "${data.moneda}" no encontrada`);
  }

  try {
    const repo = ds.getRepository(Cotizacion);
    const created = await repo.save(
      repo.create({
        fechaInicial: data.fechaInicial,
        fechaFinal: data.fechaFinal,
        cotizacion: data.cotizacion,
        moneda: monedaEntity,
        usuario: { id: userId },
      })
    );
    refresh();
    return getCotizacionById(created.id);
  } catch (error) {
    dbError(error, "Cotización");
  }
}

export async function actualizarCotizacion(
  id: number,
  input: z.infer<typeof cotizacionUpdateSchema>
) {
  const userId = await requireUserId();
  const data = cotizacionUpdateSchema.parse(input);
  const ds = await getDb();

  const existing = await ds
    .getRepository(Cotizacion)
    .findOneBy({ id, usuario: { id: userId }, eliminado: false });
  if (!existing) {
    throw new Error(`Cotización con id ${id} no encontrada`);
  }

  if (data.moneda) {
    const monedaEntity = await ds
      .getRepository(Moneda)
      .findOneBy({ nombre: data.moneda, eliminado: false });
    if (!monedaEntity) {
      throw new Error(`Moneda con nombre "${data.moneda}" no encontrada`);
    }
    existing.moneda = monedaEntity;
  }

  try {
    const { moneda, ...rest } = data;
    Object.assign(existing, rest);
    await ds.getRepository(Cotizacion).save(existing);
    refresh();
    return getCotizacionById(id);
  } catch (error) {
    dbError(error, "Cotización");
  }
}

export async function eliminarCotizacion(id: number) {
  const userId = await requireUserId();
  const ds = await getDb();
  const repo = ds.getRepository(Cotizacion);
  const row = await repo.findOneBy({ id, usuario: { id: userId }, eliminado: false });
  if (!row) {
    throw new Error(`Cotización con id ${id} no encontrada`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Cotización");
  }
}

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
