"use server";

import type { z } from "zod";
import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { JornadaTrabajo } from "../entities/jornada-trabajo.entity";
import { PeriodoTrabajo } from "../entities/periodo-trabajo.entity";
import { Trabajo } from "../entities/trabajo.entity";
import { dbError, refresh } from "../lib/action-helpers";
import {
  getJornadaTrabajoById,
  getPeriodoTrabajoById,
  getTrabajoById,
} from "../queries/trabajos";
import { calcularMontoACobrar, calcularMontoJornada } from "../lib/jornadas";
import {
  jornadaTrabajoCreateSchema,
  jornadaTrabajoUpdateSchema,
  periodoTrabajoCreateSchema,
  periodoTrabajoUpdateSchema,
  trabajoCreateSchema,
  trabajoUpdateSchema,
} from "../validation/trabajos";

// ---------------------------------------------------------------------------
// Helpers de lógica de jornadas (port del servicio JornadaTrabajoService)
// ---------------------------------------------------------------------------
async function actualizarMontoACobrarPeriodo(idPeriodo: number) {
  const ds = await getDb();
  const repo = ds.getRepository(PeriodoTrabajo);
  const periodo = await repo.findOne({
    where: { id: idPeriodo },
    relations: { jornadas: true },
  });
  if (!periodo) {
    throw new Error(`PeriodoTrabajo con id ${idPeriodo} no encontrado`);
  }

  // La propina NO forma parte del monto a cobrar (tarjetas "Períodos a
  // Cobrar/Actuales" del dashboard; decisión 2026-08-06). Ver lib/jornadas.
  periodo.montoACobrar = calcularMontoACobrar(periodo.jornadas ?? []);
  await repo.save(periodo);
}

// ============================================================
// TRABAJO
// ============================================================
export async function crearTrabajo(input: z.infer<typeof trabajoCreateSchema>) {
  const userId = await requireUserId();
  const data = trabajoCreateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(Trabajo);
  try {
    const created = await repo.save(
      repo.create({ ...data, usuario: { id: userId } })
    );
    refresh();
    return getTrabajoById(created.id);
  } catch (error) {
    dbError(error, "Trabajo");
  }
}

export async function actualizarTrabajo(
  id: number,
  input: z.infer<typeof trabajoUpdateSchema>
) {
  const userId = await requireUserId();
  const data = trabajoUpdateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(Trabajo);
  const existing = await repo.findOneBy({ id, usuario: { id: userId } });
  if (!existing) {
    throw new Error(`Trabajo con id ${id} no encontrado`);
  }
  try {
    Object.assign(existing, data);
    await repo.save(existing);
    refresh();
    return getTrabajoById(id);
  } catch (error) {
    dbError(error, "Trabajo");
  }
}

export async function eliminarTrabajo(id: number) {
  const userId = await requireUserId();
  const ds = await getDb();
  const repo = ds.getRepository(Trabajo);
  const row = await repo.findOneBy({ id, usuario: { id: userId }, eliminado: false });
  if (!row) {
    throw new Error(`Trabajo con id ${id} no encontrado`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Trabajo");
  }
}

// ============================================================
// PERÍODO DE TRABAJO (trabajo por nombre)
// ============================================================
export async function crearPeriodoTrabajo(
  input: z.infer<typeof periodoTrabajoCreateSchema>
) {
  const userId = await requireUserId();
  const data = periodoTrabajoCreateSchema.parse(input);
  const ds = await getDb();
  const { nombreTrabajo, ...rest } = data;

  const trabajo = await ds.getRepository(Trabajo).findOneBy({
    nombre: nombreTrabajo,
    usuario: { id: userId },
  });
  if (!trabajo) {
    throw new Error(`Trabajo con nombre "${nombreTrabajo}" no encontrado`);
  }

  try {
    const repo = ds.getRepository(PeriodoTrabajo);
    const created = await repo.save(repo.create({ ...rest, trabajo }));
    refresh();
    return getPeriodoTrabajoById(created.id);
  } catch (error) {
    dbError(error, "Período de trabajo");
  }
}

export async function actualizarPeriodoTrabajo(
  id: number,
  input: z.infer<typeof periodoTrabajoUpdateSchema>
) {
  const userId = await requireUserId();
  const data = periodoTrabajoUpdateSchema.parse(input);
  const ds = await getDb();
  const { nombreTrabajo, ...rest } = data;

  const repo = ds.getRepository(PeriodoTrabajo);
  const existing = await repo.findOne({
    where: { id, trabajo: { usuario: { id: userId } }, eliminado: false },
  });
  if (!existing) {
    throw new Error(`Período de trabajo con id ${id} no encontrado`);
  }

  if (nombreTrabajo) {
    const trabajo = await ds.getRepository(Trabajo).findOneBy({
      nombre: nombreTrabajo,
      usuario: { id: userId },
    });
    if (!trabajo) {
      throw new Error(`Trabajo con nombre "${nombreTrabajo}" no encontrado`);
    }
    existing.trabajo = trabajo;
  }

  try {
    Object.assign(existing, rest);
    await repo.save(existing);
    refresh();
    return getPeriodoTrabajoById(id);
  } catch (error) {
    dbError(error, "Período de trabajo");
  }
}

export async function eliminarPeriodoTrabajo(id: number) {
  const userId = await requireUserId();
  const ds = await getDb();
  const repo = ds.getRepository(PeriodoTrabajo);
  const row = await repo.findOne({
    where: { id, trabajo: { usuario: { id: userId } }, eliminado: false },
  });
  if (!row) {
    throw new Error(`Período de trabajo con id ${id} no encontrado`);
  }
  try {
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Período de trabajo");
  }
}

// ============================================================
// JORNADA DE TRABAJO (calcula monto y actualiza período)
// ============================================================
export async function crearJornadaTrabajo(
  input: z.infer<typeof jornadaTrabajoCreateSchema>
) {
  const userId = await requireUserId();
  const data = jornadaTrabajoCreateSchema.parse(input);
  const ds = await getDb();
  const { idPeriodo, ...rest } = data;

  const periodo = await ds.getRepository(PeriodoTrabajo).findOne({
    where: { id: idPeriodo, trabajo: { usuario: { id: userId } } },
    relations: { trabajo: true },
  });
  if (!periodo) {
    throw new Error(`Período de trabajo con id ${idPeriodo} no encontrado`);
  }

  const montoJornada = calcularMontoJornada(
    data.horaDesde,
    data.horaHasta,
    periodo.trabajo.precioHora
  );

  try {
    const repo = ds.getRepository(JornadaTrabajo);
    const created = await repo.save(
      repo.create({
        ...rest,
        periodoTrabajo: periodo,
        fechaCarga: new Date(),
        montoJornada,
      })
    );

    await actualizarMontoACobrarPeriodo(idPeriodo);

    refresh();
    return getJornadaTrabajoById(created.id);
  } catch (error) {
    dbError(error, "Jornada de trabajo");
  }
}

export async function actualizarJornadaTrabajo(
  id: string,
  input: z.infer<typeof jornadaTrabajoUpdateSchema>
) {
  const userId = await requireUserId();
  const data = jornadaTrabajoUpdateSchema.parse(input);
  const ds = await getDb();

  const existing = await ds.getRepository(JornadaTrabajo).findOne({
    where: { id, periodoTrabajo: { trabajo: { usuario: { id: userId } } }, eliminado: false },
    relations: { periodoTrabajo: true },
  });
  if (!existing) {
    throw new Error(`Jornada de trabajo con id ${id} no encontrada`);
  }

  const idPeriodo = data.idPeriodo ?? existing.periodoTrabajo?.id;
  if (!idPeriodo) {
    throw new Error("idPeriodo es requerido");
  }
  const periodo = await ds.getRepository(PeriodoTrabajo).findOne({
    where: { id: idPeriodo, trabajo: { usuario: { id: userId } } },
    relations: { trabajo: true },
  });
  if (!periodo) {
    throw new Error(`Período de trabajo con id ${idPeriodo} no encontrado`);
  }

  const montoJornada = calcularMontoJornada(
    data.horaDesde ?? existing.horaDesde,
    data.horaHasta ?? existing.horaHasta,
    periodo.trabajo.precioHora
  );

  try {
    // Excluimos idPeriodo (no es columna; se asigna vía periodoTrabajo)
    const { idPeriodo: _ignored, ...restData } = data;
    Object.assign(existing, restData, { montoJornada, periodoTrabajo: periodo });
    await ds.getRepository(JornadaTrabajo).save(existing);

    await actualizarMontoACobrarPeriodo(idPeriodo);

    refresh();
    return getJornadaTrabajoById(id);
  } catch (error) {
    dbError(error, "Jornada de trabajo");
  }
}

export async function eliminarJornadaTrabajo(id: string) {
  const userId = await requireUserId();
  const ds = await getDb();
  const repo = ds.getRepository(JornadaTrabajo);
  const row = await repo.findOne({
    where: { id, periodoTrabajo: { trabajo: { usuario: { id: userId } } }, eliminado: false },
    relations: { periodoTrabajo: true },
  });
  if (!row) {
    throw new Error(`Jornada de trabajo con id ${id} no encontrada`);
  }
  const idPeriodo = row.periodoTrabajo?.id;
  try {
    row.eliminado = true;
    await repo.save(row);
    if (idPeriodo) {
      await actualizarMontoACobrarPeriodo(idPeriodo);
    }
    refresh();
  } catch (error) {
    dbError(error, "Jornada de trabajo");
  }
}
