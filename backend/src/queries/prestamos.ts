import { MoreThan } from "typeorm";
import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { Prestamo } from "../entities/prestamo.entity";

export interface PrestamoOut {
  id: string;
  detalle: string | null;
  fecha: Date;
  monto: number;
  saldo: number;
  cuotas: number;
  sentido: string;
  personaOrigen: { nombre: string } | null;
  personaDestino: { nombre: string } | null;
  cuenta: { nombre: string } | null;
}

function mapPrestamo(r: Prestamo): PrestamoOut {
  return {
    id: r.id,
    detalle: r.detalle ?? null,
    fecha: r.fecha,
    monto: r.monto,
    saldo: r.saldo,
    cuotas: r.cuotas,
    sentido: r.sentido,
    personaOrigen: r.personaOrigen
      ? { nombre: r.personaOrigen.nombre }
      : null,
    personaDestino: r.personaDestino
      ? { nombre: r.personaDestino.nombre }
      : null,
    cuenta: r.cuenta ? { nombre: r.cuenta.nombre } : null,
  };
}

const PRESTAMO_RELATIONS = {
  personaOrigen: true,
  personaDestino: true,
  cuenta: true,
} as const;

export async function getAllPrestamos(): Promise<PrestamoOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(Prestamo).find({
    where: { usuario: { id: userId }, eliminado: false },
    relations: PRESTAMO_RELATIONS,
  });
  return rows.map(mapPrestamo);
}

export async function getPrestamosPendientes(): Promise<PrestamoOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(Prestamo).find({
    where: { usuario: { id: userId }, eliminado: false, saldo: MoreThan(0) },
    relations: PRESTAMO_RELATIONS,
  });
  return rows.map(mapPrestamo);
}

export async function getPrestamoById(id: string): Promise<PrestamoOut | null> {
  const userId = await requireUserId();
  const ds = await getDb();
  const r = await ds.getRepository(Prestamo).findOne({
    where: { id, usuario: { id: userId }, eliminado: false },
    relations: PRESTAMO_RELATIONS,
  });
  return r ? mapPrestamo(r) : null;
}
