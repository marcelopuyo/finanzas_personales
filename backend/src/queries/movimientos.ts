import { getDb } from "../db";
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
  const ds = await getDb();
  const rows = await ds.getRepository(Movimiento).find({
    where: { eliminado: false },
    relations: RELATIONS,
  });
  return rows.map(mapMovimiento);
}

export async function getMovimientoById(
  id: string
): Promise<MovimientoOut | null> {
  const ds = await getDb();
  const r = await ds.getRepository(Movimiento).findOne({
    where: { id, eliminado: false },
    relations: RELATIONS,
  });
  return r ? mapMovimiento(r) : null;
}
