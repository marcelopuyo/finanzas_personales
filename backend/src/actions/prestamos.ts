"use server";

import type { z } from "zod";
import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { Cuenta } from "../entities/cuenta.entity";
import { Persona } from "../entities/persona.entity";
import { Prestamo } from "../entities/prestamo.entity";
import { crearHistoricoCuenta, dbError, refresh } from "../lib/action-helpers";
import { getPrestamoById } from "../queries/prestamos";
import {
  prestamoCreateSchema,
  prestamoUpdateSchema,
} from "../validation/prestamos";

// ============================================================
// PRÉSTAMO (personas y cuenta por nombre; actualiza saldo de cuenta)
// ============================================================
export async function crearPrestamo(
  input: z.infer<typeof prestamoCreateSchema>
) {
  const userId = await requireUserId();
  const data = prestamoCreateSchema.parse(input);
  const ds = await getDb();
  const { personaOrigen, personaDestino, cuenta, ...rest } = data;

  const personaOrigenEntity = await ds.getRepository(Persona).findOneBy({
    nombre: personaOrigen,
    usuario: { id: userId },
  });
  if (!personaOrigenEntity) {
    throw new Error(`Persona "${personaOrigen}" no encontrada`);
  }

  const personaDestinoEntity = await ds.getRepository(Persona).findOneBy({
    nombre: personaDestino,
    usuario: { id: userId },
  });
  if (!personaDestinoEntity) {
    throw new Error(`Persona "${personaDestino}" no encontrada`);
  }

  const cuentaEntity = await ds.getRepository(Cuenta).findOneBy({
    nombre: cuenta,
    usuario: { id: userId },
  });
  if (!cuentaEntity) {
    throw new Error(`Cuenta "${cuenta}" no encontrada`);
  }

  try {
    const repo = ds.getRepository(Prestamo);
    const created = await repo.save(
      repo.create({
        ...rest,
        // El saldo inicial SIEMPRE es igual al monto (decisión 2026-08-12);
        // el saldo solo cambia con los pagos del préstamo.
        saldo: data.monto,
        personaOrigen: personaOrigenEntity,
        personaDestino: personaDestinoEntity,
        cuenta: cuentaEntity,
        usuario: { id: userId },
      })
    );

    // Actualizar saldo de la cuenta según sentido
    // otorgado → resta monto de la cuenta; obtenido → suma
    cuentaEntity.saldo =
      data.sentido === "otorgado"
        ? cuentaEntity.saldo - data.monto
        : cuentaEntity.saldo + data.monto;
    await ds.getRepository(Cuenta).save(cuentaEntity);

    // El alta de préstamo cambia el saldo de la cuenta → se actualiza el
    // histórico (cierra el vigente y crea uno nuevo con el saldo actual).
    // Sin esto, el sparkline/historial de la cuenta queda desactualizado
    // (el punto derecho muestra un saldo viejo, no el actual).
    await crearHistoricoCuenta(ds.manager, cuentaEntity);

    refresh();
    return getPrestamoById(created.id);
  } catch (error) {
    dbError(error, "Préstamo");
  }
}

export async function actualizarPrestamo(
  id: string,
  input: z.infer<typeof prestamoUpdateSchema>
) {
  const userId = await requireUserId();
  const data = prestamoUpdateSchema.parse(input);
  const ds = await getDb();
  const { personaOrigen, personaDestino, cuenta, ...rest } = data;

  const repo = ds.getRepository(Prestamo);
  const existing = await repo.findOneBy({ id, usuario: { id: userId }, eliminado: false });
  if (!existing) {
    throw new Error(`Préstamo con id ${id} no encontrado`);
  }

  if (personaOrigen) {
    const personaOrigenEntity = await ds.getRepository(Persona).findOneBy({
      nombre: personaOrigen,
      usuario: { id: userId },
    });
    if (!personaOrigenEntity) {
      throw new Error(`Persona "${personaOrigen}" no encontrada`);
    }
    existing.personaOrigen = personaOrigenEntity;
  }

  if (personaDestino) {
    const personaDestinoEntity = await ds.getRepository(Persona).findOneBy({
      nombre: personaDestino,
      usuario: { id: userId },
    });
    if (!personaDestinoEntity) {
      throw new Error(`Persona "${personaDestino}" no encontrada`);
    }
    existing.personaDestino = personaDestinoEntity;
  }

  if (cuenta) {
    const cuentaEntity = await ds.getRepository(Cuenta).findOneBy({
      nombre: cuenta,
      usuario: { id: userId },
    });
    if (!cuentaEntity) {
      throw new Error(`Cuenta "${cuenta}" no encontrada`);
    }
    existing.cuenta = cuentaEntity;
  }

  try {
    Object.assign(existing, rest);
    await repo.save(existing);
    refresh();
    return getPrestamoById(id);
  } catch (error) {
    dbError(error, "Préstamo");
  }
}

export async function eliminarPrestamo(id: string) {
  const userId = await requireUserId();
  const ds = await getDb();
  const repo = ds.getRepository(Prestamo);
  const row = await repo.findOneBy({ id, usuario: { id: userId }, eliminado: false });
  if (!row) {
    throw new Error(`Préstamo con id ${id} no encontrado`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Préstamo");
  }
}
