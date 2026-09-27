"use server";

// Acciones del CRUD de **TRABAJOS** — el único CRUD del circuito de trabajo que
// sigue vivo. Los CRUDs de **períodos, jornadas y tareas** se archivaron en
// `archivo/` con el rediseño de liquidaciones (`plan-liquidaciones.md`):
//
//  · la jornada y la tarea se cargan desde el **wizard de movimientos**
//    (`actions/movimientos.ts`: `cargarJornadaTrabajo` / `cargarTareaTrabajo`) y
//    nacen **pendientes de liquidar**;
//  · el **cobro** crea la liquidación (`cobrarTrabajo`) y la anulación la deshace.
//
// Por eso acá sólo quedan alta/edición/baja de trabajo (+ el guard de la
// conversión de modalidad).

import type { z } from "zod";
import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { Liquidacion } from "../entities/periodo-trabajo.entity";
import { Trabajo } from "../entities/trabajo.entity";
import { dbError, refresh } from "../lib/action-helpers";
import { formatearFechaDMA, periodoCobrado } from "../lib/jornadas";
import { getTrabajoById } from "../queries/trabajos";
import {
  trabajoCreateSchema,
  trabajoUpdateSchema,
} from "../validation/trabajos";

/**
 * ¿Hay una **liquidación vigente hoy** de este trabajo? (guard de la conversión
 * de modalidad).
 *
 * En el modelo nuevo una liquidación existe sólo si se **cobró**, así que
 * "vigente" = una liquidación cobrada cuyo rango cubre hoy (ej.: un `fijo`
 * mensual cobrado el día 3 sigue vigente hasta fin de mes). Lo que se evita es
 * cambiar la modalidad con esa liquidación en curso: la modalidad decide **qué se
 * carga** (jornadas o tareas) y **cómo se calcula el próximo cobro**.
 */
async function periodoVigenteDe(
  ds: Awaited<ReturnType<typeof getDb>>,
  trabajoId: number
): Promise<Liquidacion | null> {
  const hoyKey = new Date().toISOString().slice(0, 10);
  const repo = ds.getRepository(Liquidacion);
  return repo
    .createQueryBuilder("pt")
    .where("pt.trabajoId = :trabajoId", { trabajoId })
    .andWhere("pt.eliminado = :eliminado", { eliminado: false })
    .andWhere("pt.fechaDesde <= :hoy", { hoy: hoyKey })
    .andWhere("pt.fechaHasta >= :hoy", { hoy: hoyKey })
    .limit(1)
    .getOne();
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
      repo.create({
        ...data,
        // Default conservador: la modalidad que hoy tienen todos los trabajos.
        modalidadCobro: data.modalidadCobro ?? "horas_variables",
        usuario: { id: userId },
      })
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

  // Conversión de modalidad: bloqueada si el trabajo tiene una liquidación
  // VIGENTE hoy (aunque ya esté cobrada): la conversión sólo afecta lo que viene.
  const modalidadActual = existing.modalidadCobro ?? "horas_variables";
  if (data.modalidadCobro && data.modalidadCobro !== modalidadActual) {
    const vigente = await periodoVigenteDe(ds, existing.id);
    if (vigente) {
      const rango = `${formatearFechaDMA(vigente.fechaDesde)} al ${formatearFechaDMA(
        vigente.fechaHasta
      )}`;
      // Si ya se cobró no tiene sentido pedir "cerrá o cobrá".
      const salida = periodoCobrado(vigente)
        ? ", aunque ya esté cobrado. Vas a poder cambiarla cuando termine."
        : ". Cerrá o cobrá ese período primero.";
      throw new Error(
        `No podés cambiar la modalidad de "${existing.nombre}" porque tiene un período en curso (${rango})${salida}`
      );
    }
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
  const row = await repo.findOneBy({
    id,
    usuario: { id: userId },
    eliminado: false,
  });
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
