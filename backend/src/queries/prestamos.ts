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
  sentido: string;
  /** Contraparte del préstamo (la otra parte es el usuario). */
  personaContraparte: { id: number; nombre: string } | null;
  cuenta: { nombre: string } | null;
  /** ISO 4217 de la moneda del préstamo (moneda de su cuenta). */
  monedaISO: string;
}

function mapPrestamo(r: Prestamo): PrestamoOut {
  return {
    id: r.id,
    detalle: r.detalle ?? null,
    fecha: r.fecha,
    monto: r.monto,
    saldo: r.saldo,
    sentido: r.sentido,
    personaContraparte: r.personaContraparte
      ? { id: r.personaContraparte.id, nombre: r.personaContraparte.nombre }
      : null,
    cuenta: r.cuenta ? { nombre: r.cuenta.nombre } : null,
    monedaISO: r.cuenta?.moneda?.codigoISO ?? "ARS",
  };
}

const PRESTAMO_RELATIONS = {
  personaContraparte: true,
  cuenta: { moneda: true },
} as const;

export async function getAllPrestamos(): Promise<PrestamoOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(Prestamo).find({
    where: { usuario: { id: userId }, eliminado: false },
    relations: PRESTAMO_RELATIONS,
    // Más recientes primero.
    order: { fecha: "DESC" },
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
