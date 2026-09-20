import { getDb } from "../db";
import { requireUserId } from "../lib/auth";
import { Cuenta } from "../entities/cuenta.entity";
import { Movimiento } from "../entities/movimiento.entity";
import { HistoricoCuenta } from "../entities/historico-cuenta.entity";

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
  /** Id del movimiento (para anularlo desde el popup). */
  id: string;
  fecha: Date;
  /** Monto en la moneda de la cuenta (el saldo se guarda en esa moneda). */
  monto: number;
  /** Equivalente en la moneda predeterminada del usuario (secundario). */
  montoPredeterminada: number;
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

  // Movimientos de la cuenta (no eliminados) con las relaciones que usa la
  // query original (concepto + gasto).
  const movs = await ds.getRepository(Movimiento).find({
    where: { cuenta: { id: cuentaId }, eliminado: false },
    relations: { concepto: true, gasto: true },
  });
  if (movs.length === 0) return [];

  // `movimiento.fecha` es solo fecha (type date, sin hora). Para ordenar
  // dentro del mismo día se usa la hora REAL de registro: cada movimiento crea,
  // en la misma transacción, un snapshot en historico_cuenta con su movimientoId
  // y fechaDesde = momento en que se aplicó a la cuenta (crearHistoricoCuenta).
  const historicos = await ds.getRepository(HistoricoCuenta).find({
    where: { eliminado: false, cuenta: { id: cuentaId } },
    relations: { movimiento: true },
  });
  const fechaDesdePorMovimiento = new Map<string, Date>();
  for (const h of historicos) {
    if (h.movimiento) fechaDesdePorMovimiento.set(h.movimiento.id, h.fechaDesde);
  }

  // Orden cronológico ASC por (fecha del movimiento, hora real de registro)
  // para calcular el saldo corrido; la salida final se invierte a DESC.
  // Los movimientos legacy sin snapshot se ordenan como si se registraran a
  // las 00:00 de su propia fecha (quedan al inicio del día).
  const fechaRegistro = (m: Movimiento): number => {
    const ts = fechaDesdePorMovimiento.get(m.id);
    return ts ? ts.getTime() : new Date(m.fecha).getTime();
  };
  const movsOrdenados = [...movs].sort((a, b) => {
    const porFecha = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
    if (porFecha !== 0) return porFecha;
    const porHora = fechaRegistro(a) - fechaRegistro(b);
    if (porHora !== 0) return porHora;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // Variación de la cuenta según la categoría del concepto (egreso → resta).
  // Se usa el monto en la moneda de la cuenta (el saldo y el historial se
  // guardan en la moneda de la cuenta; `monto` quedó en la predeterminada).
  const variaciones = movsOrdenados.map((m) => {
    const esEgreso = m.concepto?.categoria?.toLowerCase() === "egreso";
    return esEgreso
      ? -Math.abs(m.montoCuentaMonedaOrigen)
      : Math.abs(m.montoCuentaMonedaOrigen);
  });

  // Saldo de la cuenta ANTES del primer movimiento de la lista
  let saldo = cuenta.saldo - variaciones.reduce((a, b) => a + b, 0);

  // Running-sum en memoria: saldoPosterior[i] = saldoBase + Σ variaciones[0..i]
  const result: HistorialMovimientoOut[] = [];
  for (let i = 0; i < movsOrdenados.length; i++) {
    const m = movsOrdenados[i];
    saldo += variaciones[i];
    const desc = m.gasto?.descripcion;
    result.push({
      id: m.id,
      fecha: m.fecha,
      monto: m.montoCuentaMonedaOrigen,
      // Equivalente en la moneda predeterminada del usuario (secundario).
      montoPredeterminada: m.monto,
      motivo: desc ? desc : (m.concepto?.nombre ?? ""),
      categoria: m.concepto?.categoria ?? null,
      saldoPosterior: saldo,
    });
  }

  // Salida en orden cronológico DESC por fecha-hora (más reciente primero)
  return result.reverse();
}

/** Una "tanda" del historial (scroll infinito de `/cuentas/[id]`). */
export interface HistorialPagina {
  rows: HistorialMovimientoOut[];
  /** Total de movimientos de la cuenta (sin recortar). */
  total: number;
  /** Quedan movimientos MÁS VIEJOS que el último de `rows`. */
  hayMas: boolean;
}

/** Tope de filas por pedido: el tamaño de página lo propone el cliente. */
const MAX_HISTORIAL_LIMIT = 100;

/**
 * Ventana del historial de una cuenta, para el **scroll infinito** de la pantalla
 * de movimientos (`/cuentas/[id]`).
 *
 * ⚠️ **Por qué se calcula la lista completa y se recorta acá**: el
 * `saldoPosterior` es un **saldo corrido** que se arma desde el movimiento MÁS
 * VIEJO hacia adelante (ver `getHistorialMovimientosCuenta`), así que el saldo de
 * cada fila depende de TODAS las anteriores: no se puede resolver una página
 * suelta sin conocer ese arrastre. Hacerlo en una sola consulta exigiría una
 * *window function* sobre el orden `(fecha, fechaDesde, id)` —queda como mejora
 * futura si alguna cuenta acumula miles de movimientos—. Lo que sí resuelve esto
 * es el problema real: el cliente recibe **solo `limit` filas** por pedido (antes
 * el popup se traía el historial entero de una).
 */
export async function getHistorialMovimientosCuentaPaginado(
  cuentaId: number,
  { offset = 0, limit = 20 }: { offset?: number; limit?: number } = {}
): Promise<HistorialPagina> {
  const todos = await getHistorialMovimientosCuenta(cuentaId);
  const desde = Math.max(0, Math.floor(offset));
  const cuantas = Math.min(
    Math.max(1, Math.floor(limit)),
    MAX_HISTORIAL_LIMIT
  );
  const rows = todos.slice(desde, desde + cuantas);
  return {
    rows,
    total: todos.length,
    hayMas: desde + rows.length < todos.length,
  };
}
