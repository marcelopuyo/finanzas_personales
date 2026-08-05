import { revalidatePath } from "next/cache";
import type { EntityManager } from "typeorm";
import { IsNull } from "typeorm";
import { Cuenta } from "../entities/cuenta.entity";
import { HistoricoCuenta } from "../entities/historico-cuenta.entity";

// Invalida la caché de la app tras cada mutación.
// TODO (Fase 10): afinar a las rutas CRUD específicas de cada entidad.
export function refresh() {
  revalidatePath("/", "layout");
}

// Traduce errores de unicidad / inesperados a mensajes amigables.
export function dbError(error: unknown, entity: string): never {
  const err = error as { number?: number; message?: string };
  if (err?.number === 2627) {
    throw new Error(`${entity} existente`);
  }
  throw new Error(`Error inesperado: ${err?.message ?? "desconocido"}`);
}

/**
 * Cierra el registro abierto del histórico de la cuenta y crea uno nuevo
 * con el saldo actual. Se usa en todos los movimientos (cobro, pago, ajuste,
 * transferencia, reversión de gasto).
 */
export async function crearHistoricoCuenta(
  manager: EntityManager,
  cuenta: Cuenta,
  /** ID del movimiento que originó este histórico (opcional, p.ej. para reversiones). */
  movimientoId?: string
) {
  const historicoRepo = manager.getRepository(HistoricoCuenta);

  const existente = await historicoRepo.findOne({
    where: {
      eliminado: false,
      fechaHasta: IsNull(),
      cuenta: { id: cuenta.id },
    },
    relations: { cuenta: true },
  });

  if (existente) {
    existente.fechaHasta = new Date();
    await historicoRepo.save(existente);
  }

  const nuevo = historicoRepo.create({
    fechaDesde: new Date(),
    saldo: cuenta.saldo,
    cuenta,
    ...(movimientoId ? { movimiento: { id: movimientoId } } : {}),
  } as any);
  await historicoRepo.save(nuevo);
}

