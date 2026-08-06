import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { Cuenta } from "../entities/cuenta.entity";
import { Movimiento } from "../entities/movimiento.entity";

export interface MovimientoOut {
  id: string;
  fecha: Date;
  monto: number;
  concepto: { nombre: string } | null;
  cuenta: { nombre: string; id: number } | null;
  prestamo: { id: string } | null;
  gasto: { descripcion: string; id: string } | null;
}

function mapMovimiento(r: Movimiento): MovimientoOut {
  return {
    id: r.id,
    fecha: r.fecha,
    monto: r.monto,
    concepto: r.concepto ? { nombre: r.concepto.nombre } : null,
    cuenta: r.cuenta
      ? { nombre: r.cuenta.nombre, id: r.cuenta.id }
      : null,
    prestamo: r.prestamo ? { id: r.prestamo.id } : null,
    gasto: r.gasto
      ? { descripcion: r.gasto.descripcion, id: r.gasto.id }
      : null,
  };
}

const RELATIONS = {
  concepto: true,
  cuenta: true,
  prestamo: true,
  gasto: true,
} as const;

export async function getAllMovimientos(): Promise<MovimientoOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(Movimiento).find({
    where: { cuenta: { usuario: { id: userId } }, eliminado: false },
    relations: RELATIONS,
  });
  return rows.map(mapMovimiento);
}

export async function getMovimientoById(
  id: string
): Promise<MovimientoOut | null> {
  const userId = await requireUserId();
  const ds = await getDb();
  const r = await ds.getRepository(Movimiento).findOne({
    where: { id, cuenta: { usuario: { id: userId } }, eliminado: false },
    relations: RELATIONS,
  });
  return r ? mapMovimiento(r) : null;
}

// ============================================================
// Historial cronológico de movimientos por cuenta (con saldo posterior)
// ============================================================
export interface HistorialMovimientoOut {
  fecha: Date;
  monto: number;
  motivo: string;
  categoria: string | null;
  saldoPosterior: number;
}

export async function getHistorialMovimientosCuenta(
  cuentaId: number
): Promise<HistorialMovimientoOut[]> {
  const userId = await requireUserId();
  const ds = await getDb();

  // La cuenta debe pertenecer al usuario autenticado.
  const cuenta = await ds.getRepository(Cuenta).findOneBy({
    id: cuentaId,
    usuario: { id: userId },
  });
  if (!cuenta) return [];

  // Movimientos de la cuenta (no eliminados) en orden cronológico ASC,
  // con las relaciones que usa la query original (concepto + gasto).
  const movs = await ds.getRepository(Movimiento).find({
    where: { cuenta: { id: cuentaId }, eliminado: false },
    relations: { concepto: true, gasto: true },
    order: { fecha: "ASC", id: "ASC" },
  });
  if (movs.length === 0) return [];

  // Variación de la cuenta según la categoría del concepto (egreso → resta)
  const variaciones = movs.map((m) => {
    const esEgreso = m.concepto?.categoria?.toLowerCase() === "egreso";
    return esEgreso ? -Math.abs(m.monto) : Math.abs(m.monto);
  });

  // Saldo de la cuenta ANTES del primer movimiento de la lista
  let saldo = cuenta.saldo - variaciones.reduce((a, b) => a + b, 0);

  // Running-sum en memoria: saldoPosterior[i] = saldoBase + Σ variaciones[0..i]
  const result: HistorialMovimientoOut[] = [];
  for (let i = 0; i < movs.length; i++) {
    const m = movs[i];
    saldo += variaciones[i];
    const desc = m.gasto?.descripcion;
    result.push({
      fecha: m.fecha,
      monto: m.monto,
      motivo: desc ? desc : (m.concepto?.nombre ?? ""),
      categoria: m.concepto?.categoria ?? null,
      saldoPosterior: saldo,
    });
  }

  // Salida en orden cronológico DESC (como el ORDER BY final del SQL)
  return result.reverse();
}
