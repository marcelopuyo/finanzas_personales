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
  const ds = await getDb();
  const raw: any[] = await ds.query(
    `WITH firmados AS (
       SELECT m.id, m.fecha, m.monto,
         COALESCE(NULLIF(g.descripcion, ''), c.nombre) AS motivo,
         c.categoria AS categoria,
         -- Variación de la cuenta según la categoría del concepto
         CASE WHEN LOWER(c.categoria) = 'egreso'
              THEN -ABS(CAST(m.monto AS float))
              ELSE ABS(CAST(m.monto AS float)) END AS variacion
       FROM movimiento m
       JOIN concepto c ON m.conceptoId = c.id
       LEFT JOIN gasto g ON g.id = m.gastoId
       WHERE m.cuentaId = @0 AND m.eliminado = 0
     ),
     base AS (
       -- Saldo de la cuenta ANTES del primer movimiento de la lista
       SELECT (SELECT saldo FROM cuenta WHERE id = @0)
            - (SELECT COALESCE(SUM(variacion),0) FROM firmados) AS saldoBase
     )
     SELECT f.fecha, f.monto, f.motivo, f.categoria,
       b.saldoBase + SUM(f.variacion) OVER (
         ORDER BY f.fecha, f.id ROWS UNBOUNDED PRECEDING
       ) AS saldoPosterior
     FROM firmados f
     CROSS JOIN base b
     ORDER BY f.fecha DESC, f.id DESC`,
    [cuentaId]
  );
  return raw.map((r: any) => ({
    fecha: r.fecha,
    monto: Number(r.monto),
    motivo: r.motivo,
    categoria: r.categoria ?? null,
    saldoPosterior: Number(r.saldoPosterior ?? 0),
  }));
}
