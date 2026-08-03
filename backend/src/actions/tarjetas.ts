"use server";

import type { z } from "zod";
import { getDb } from "../db";
import { Cuenta } from "../entities/cuenta.entity";
import { MovimientoTarjeta } from "../entities/movimiento-tarjeta.entity";
import { PeriodoTarjeta } from "../entities/periodo-tarjeta.entity";
import { Persona } from "../entities/persona.entity";
import { Tarjeta } from "../entities/tarjeta.entity";
import { dbError, refresh } from "../lib/action-helpers";
import {
  getMovimientoTarjetaById,
  getPeriodoTarjetaById,
  getTarjetaById,
} from "../queries/tarjetas";
import {
  movimientoTarjetaCreateSchema,
  movimientoTarjetaUpdateSchema,
  periodoTarjetaCreateSchema,
  periodoTarjetaUpdateSchema,
  tarjetaCreateSchema,
  tarjetaUpdateSchema,
} from "../validation/tarjetas";

// ============================================================
// TARJETA (cuenta por nombre; actualiza FK tarjetaId de la cuenta)
// ============================================================
export async function crearTarjeta(input: z.infer<typeof tarjetaCreateSchema>) {
  const data = tarjetaCreateSchema.parse(input);
  const ds = await getDb();
  const { cuenta, ...rest } = data;

  const cuentaEntity = await ds
    .getRepository(Cuenta)
    .findOneBy({ nombre: cuenta });
  if (!cuentaEntity) {
    throw new Error(`Cuenta con nombre "${cuenta}" no encontrada`);
  }

  try {
    const repo = ds.getRepository(Tarjeta);
    const created = await repo.save(
      repo.create({ ...rest, cuenta: cuentaEntity })
    );

    // Guardar la tarjeta en la cuenta (FK tarjetaId)
    cuentaEntity.tarjetaId = created.id;
    await ds.getRepository(Cuenta).save(cuentaEntity);

    refresh();
    return getTarjetaById(created.id);
  } catch (error) {
    dbError(error, "Tarjeta");
  }
}

export async function actualizarTarjeta(
  id: number,
  input: z.infer<typeof tarjetaUpdateSchema>
) {
  const data = tarjetaUpdateSchema.parse(input);
  const ds = await getDb();
  const { cuenta, ...rest } = data;

  const repo = ds.getRepository(Tarjeta);
  const existing = await repo.preload({ id, ...rest });
  if (!existing) {
    throw new Error(`Tarjeta con id ${id} no encontrada`);
  }

  if (cuenta) {
    const cuentaEntity = await ds
      .getRepository(Cuenta)
      .findOneBy({ nombre: cuenta });
    if (!cuentaEntity) {
      throw new Error(`Cuenta con nombre "${cuenta}" no encontrada`);
    }
    existing.cuenta = cuentaEntity;
    cuentaEntity.tarjetaId = id;
    await ds.getRepository(Cuenta).save(cuentaEntity);
  }

  try {
    await repo.save(existing);
    refresh();
    return getTarjetaById(id);
  } catch (error) {
    dbError(error, "Tarjeta");
  }
}

export async function eliminarTarjeta(id: number) {
  const ds = await getDb();
  const repo = ds.getRepository(Tarjeta);
  const row = await repo.findOneBy({ id, eliminado: false });
  if (!row) {
    throw new Error(`Tarjeta con id ${id} no encontrada`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Tarjeta");
  }
}

// ============================================================
// PERÍODO DE TARJETA (tarjeta por nombre)
// ============================================================
export async function crearPeriodoTarjeta(
  input: z.infer<typeof periodoTarjetaCreateSchema>
) {
  const data = periodoTarjetaCreateSchema.parse(input);
  const ds = await getDb();
  const { tarjeta, ...rest } = data;

  const tarjetaEntity = await ds
    .getRepository(Tarjeta)
    .findOneBy({ nombre: tarjeta });
  if (!tarjetaEntity) {
    throw new Error(`Tarjeta con nombre "${tarjeta}" no encontrada`);
  }

  try {
    const repo = ds.getRepository(PeriodoTarjeta);
    const created = await repo.save(
      repo.create({ ...rest, tarjeta: tarjetaEntity })
    );
    refresh();
    return getPeriodoTarjetaById(created.id);
  } catch (error) {
    dbError(error, "Período de tarjeta");
  }
}

export async function actualizarPeriodoTarjeta(
  id: number,
  input: z.infer<typeof periodoTarjetaUpdateSchema>
) {
  const data = periodoTarjetaUpdateSchema.parse(input);
  const ds = await getDb();
  const { tarjeta, ...rest } = data;

  const repo = ds.getRepository(PeriodoTarjeta);
  const existing = await repo.preload({ id, ...rest });
  if (!existing) {
    throw new Error(`Período de tarjeta con id ${id} no encontrado`);
  }

  if (tarjeta) {
    const tarjetaEntity = await ds
      .getRepository(Tarjeta)
      .findOneBy({ nombre: tarjeta });
    if (!tarjetaEntity) {
      throw new Error(`Tarjeta con nombre "${tarjeta}" no encontrada`);
    }
    existing.tarjeta = tarjetaEntity;
  }

  try {
    await repo.save(existing);
    refresh();
    return getPeriodoTarjetaById(id);
  } catch (error) {
    dbError(error, "Período de tarjeta");
  }
}

export async function eliminarPeriodoTarjeta(id: number) {
  const ds = await getDb();
  const repo = ds.getRepository(PeriodoTarjeta);
  const row = await repo.findOneBy({ id, eliminado: false });
  if (!row) {
    throw new Error(`Período de tarjeta con id ${id} no encontrado`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Período de tarjeta");
  }
}

// ============================================================
// MOVIMIENTO DE TARJETA (persona/tarjeta/periodo por nombre)
// ============================================================
export async function crearMovimientoTarjeta(
  input: z.infer<typeof movimientoTarjetaCreateSchema>
) {
  const data = movimientoTarjetaCreateSchema.parse(input);
  const ds = await getDb();
  const { persona, tarjeta, periodo, ...rest } = data;

  const personaEntity = await ds
    .getRepository(Persona)
    .findOneBy({ nombre: persona });
  if (!personaEntity) {
    throw new Error(`Persona con nombre "${persona}" no encontrada`);
  }

  const tarjetaEntity = await ds
    .getRepository(Tarjeta)
    .findOneBy({ nombre: tarjeta });
  if (!tarjetaEntity) {
    throw new Error(`Tarjeta con nombre "${tarjeta}" no encontrada`);
  }

  const periodoEntity = await ds
    .getRepository(PeriodoTarjeta)
    .findOneBy({ nombre: periodo });
  if (!periodoEntity) {
    throw new Error(`Período con nombre "${periodo}" no encontrado`);
  }

  try {
    const repo = ds.getRepository(MovimientoTarjeta);
    const created = await repo.save(
      repo.create({
        ...rest,
        persona: personaEntity,
        tarjeta: tarjetaEntity,
        periodo: periodoEntity,
      })
    );
    refresh();
    return getMovimientoTarjetaById(created.id);
  } catch (error) {
    dbError(error, "Movimiento de tarjeta");
  }
}

export async function actualizarMovimientoTarjeta(
  id: string,
  input: z.infer<typeof movimientoTarjetaUpdateSchema>
) {
  const data = movimientoTarjetaUpdateSchema.parse(input);
  const ds = await getDb();
  const { persona, tarjeta, periodo, ...rest } = data;

  const repo = ds.getRepository(MovimientoTarjeta);
  const existing = await repo.findOneBy({ id, eliminado: false });
  if (!existing) {
    throw new Error(`Movimiento de tarjeta con id ${id} no encontrado`);
  }

  if (persona) {
    const personaEntity = await ds
      .getRepository(Persona)
      .findOneBy({ nombre: persona });
    if (!personaEntity) {
      throw new Error(`Persona con nombre "${persona}" no encontrada`);
    }
    existing.persona = personaEntity;
  }

  if (tarjeta) {
    const tarjetaEntity = await ds
      .getRepository(Tarjeta)
      .findOneBy({ nombre: tarjeta });
    if (!tarjetaEntity) {
      throw new Error(`Tarjeta con nombre "${tarjeta}" no encontrada`);
    }
    existing.tarjeta = tarjetaEntity;
  }

  if (periodo) {
    const periodoEntity = await ds
      .getRepository(PeriodoTarjeta)
      .findOneBy({ nombre: periodo });
    if (!periodoEntity) {
      throw new Error(`Período con nombre "${periodo}" no encontrado`);
    }
    existing.periodo = periodoEntity;
  }

  try {
    Object.assign(existing, rest);
    await repo.save(existing);
    refresh();
    return getMovimientoTarjetaById(id);
  } catch (error) {
    dbError(error, "Movimiento de tarjeta");
  }
}

export async function eliminarMovimientoTarjeta(id: string) {
  const ds = await getDb();
  const repo = ds.getRepository(MovimientoTarjeta);
  const row = await repo.findOneBy({ id, eliminado: false });
  if (!row) {
    throw new Error(`Movimiento de tarjeta con id ${id} no encontrado`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Movimiento de tarjeta");
  }
}
