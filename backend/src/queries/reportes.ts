import { Between, In, IsNull, LessThanOrEqual, MoreThan, MoreThanOrEqual } from "typeorm";
import { getDb } from "../db";
import { Cuenta } from "../entities/cuenta.entity";
import { Gasto } from "../entities/gasto.entity";
import { HistoricoCuenta } from "../entities/historico-cuenta.entity";
import { JornadaTrabajo } from "../entities/jornada-trabajo.entity";
import { Movimiento } from "../entities/movimiento.entity";
import { PeriodoGasto } from "../entities/periodo-gasto.entity";
import { Prestamo } from "../entities/prestamo.entity";

// ============================================================
// Tipos de salida (coinciden con los DTOs del backend)
// ============================================================
export interface EvolucionItem {
  periodo: string;
  monto: number;
}

export interface EvolucionResultado {
  id: string;
  valor: number;
}

export interface CuentaConEvolucion {
  nombreCuenta: string;
  saldoCuenta: number;
  serieEjeX: string[];
  valoresEjeX: number[];
}

export interface GastoPeriodo {
  id: string;
  descripcion: string | null;
  monto: number;
  saldo: number;
  fechaVencimiento: Date | null;
  fechaPago: Date | null;
  isPeriodico: boolean;
  categoria: { nombre: string } | null;
  periodo: { nombre: string } | null;
  /** Cuenta con la que se pagó el gasto (desde el Movimiento). */
  cuenta: string | null;
}

// ============================================================
// 1) Balance actual
// ============================================================
export async function getBalanceActual(): Promise<number> {
  const ds = await getDb();

  // Cuentas en dólares de tipo bancaria o caja
  const cuentas = await ds.getRepository(Cuenta).find({
    where: {
      eliminado: false,
      tipo: [{ nombre: "Cuenta Bancaria" }, { nombre: "Caja Fisica" }],
      moneda: { nombre: "Dolar Estadounidense" },
    },
    relations: { tipo: true, moneda: true },
  });

  let saldoCajas = 0;
  for (const c of cuentas) {
    saldoCajas += c.saldo;
  }

  // Gastos pendientes (saldo > 0)
  const gastos = await ds.getRepository(Gasto).find({
    where: { eliminado: false, saldo: MoreThan(0) },
  });

  let saldoGastos = 0;
  for (const g of gastos) {
    saldoGastos += g.saldo;
  }

  return saldoCajas - saldoGastos;
}

// ============================================================
// 2) Gastos del período
// ============================================================
export async function getGastosPeriodo(
  idPeriodo?: number,
  fechaDesde?: string,
  fechaHasta?: string
): Promise<GastoPeriodo[]> {
  const ds = await getDb();
  const gastoRepo = ds.getRepository(Gasto);

  if (fechaDesde && fechaHasta) {
    const rows = await gastoRepo.find({
      where: {
        eliminado: false,
        fechaPago: Between(new Date(fechaDesde), new Date(fechaHasta)),
      },
      relations: { periodo: true, categoria: true },
    });
    return withCuentas(rows, ds);
  }

  let id = idPeriodo;
  if (!id) {
    const now = new Date();
    const actual = await ds.getRepository(PeriodoGasto).findOne({
      where: {
        eliminado: false,
        fechaApertura: LessThanOrEqual(now),
        fechaCierre: MoreThanOrEqual(now),
      },
    });
    if (!actual) return [];
    id = actual.id;
  }

  const rows = await gastoRepo.find({
    where: { eliminado: false, periodo: { id } },
    relations: { periodo: true, categoria: true },
  });
  return withCuentas(rows, ds);
}

/** Resuelve las cuentas de pago para una lista de gastos en batch. */
async function withCuentas(
  rows: Gasto[],
  ds: Awaited<ReturnType<typeof getDb>>
): Promise<GastoPeriodo[]> {
  const mapped = rows.map(mapGastoPeriodo);
  const ids = mapped.map((g) => g.id).filter((id): id is string => !!id);
  if (ids.length === 0) return mapped;

  const movimientos = await ds.getRepository(Movimiento).find({
    where: { gasto: { id: In(ids) }, eliminado: false },
    relations: { cuenta: true, gasto: true },
  });
  const cuentas = new Map<string, string>();
  for (const mov of movimientos) {
    if (mov.gasto?.id && mov.cuenta?.nombre) {
      cuentas.set(mov.gasto.id, mov.cuenta.nombre);
    }
  }
  return mapped.map((g) => ({ ...g, cuenta: cuentas.get(g.id) ?? null }));
}

function mapGastoPeriodo(r: Gasto): GastoPeriodo {
  return {
    id: r.id,
    descripcion: r.descripcion ?? null,
    monto: r.monto,
    saldo: r.saldo,
    fechaVencimiento: r.fechaVencimiento ?? null,
    fechaPago: r.fechaPago ?? null,
    isPeriodico: r.isPeriodico,
    categoria: r.categoria ? { nombre: r.categoria.nombre } : null,
    periodo: r.periodo ? { nombre: r.periodo.nombre } : null,
    cuenta: null,
  };
}

// ============================================================
// 3) Evolución de gastos (por período)
// ============================================================
export async function getEvolucionGastos(): Promise<EvolucionItem[]> {
  const ds = await getDb();
  // Cargamos gastos con su periodo y agrupamos manualmente (PeriodoGasto
  // no tiene la inversa gastos para evitar ciclos de importación).
  const gastos = await ds.getRepository(Gasto).find({
    where: { eliminado: false },
    relations: { periodo: true },
  });

  const agrupado: Record<string, number> = {};
  for (const g of gastos) {
    const nombre = g.periodo?.nombre ?? "Sin período";
    agrupado[nombre] = (agrupado[nombre] || 0) + g.monto;
  }

  // Ordenamos por id del período para consistencia con el backend
  const periodos = await ds.getRepository(PeriodoGasto).find({
    where: { eliminado: false },
    order: { id: "ASC" },
  });
  return periodos
    .filter((p) => agrupado[p.nombre] !== undefined)
    .map((p) => ({ periodo: p.nombre, monto: agrupado[p.nombre] ?? 0 }));
}

// ============================================================
// 4) Evolución de gastos mensual (agrupado por mes-año)
// ============================================================
export async function getEvolucionGastosMensual(): Promise<EvolucionItem[]> {
  const ds = await getDb();
  const gastos = await ds.getRepository(Gasto).find({
    where: { eliminado: false },
    order: { fechaPago: "ASC" },
  });

  const agrupado: Record<string, number> = {};
  for (const g of gastos) {
    if (!g.fechaPago) continue;
    const d = new Date(g.fechaPago);
    const mes = d.toLocaleDateString("es-ES", { month: "short" });
    const key = `${mes}-${d.getFullYear()}`;
    agrupado[key] = (agrupado[key] || 0) + g.monto;
  }

  return Object.entries(agrupado).map(([periodo, monto]) => ({ periodo, monto }));
}

// ============================================================
// 5) Evolución de ingresos (por mes, desde jornadas)
// ============================================================
export async function getEvolucionIngresos(): Promise<EvolucionItem[]> {
  const ds = await getDb();
  const jornadas = await ds.getRepository(JornadaTrabajo).find({
    where: { eliminado: false },
    order: { fechaJornada: "ASC" },
  });

  const agrupado: Record<string, number> = {};
  for (const j of jornadas) {
    const d = new Date(j.fechaJornada);
    const mes = d.toLocaleDateString("es-ES", { month: "short" });
    const key = `${mes}-${d.getFullYear()}`;
    agrupado[key] = (agrupado[key] || 0) + j.montoJornada + j.montoPropina;
  }

  return Object.entries(agrupado).map(([periodo, monto]) => ({ periodo, monto }));
}

// ============================================================
// 6) Evolución de resultados (ingresos – gastos por mes)
// ============================================================
export async function getEvolucionResultados(): Promise<EvolucionResultado[]> {
  const [ingresos, gastos] = await Promise.all([
    getEvolucionIngresos(),
    getEvolucionGastosMensual(),
  ]);

  const resultado: Record<string, number> = {};

  for (const item of ingresos) {
    resultado[item.periodo] = (resultado[item.periodo] || 0) + item.monto;
  }
  for (const item of gastos) {
    resultado[item.periodo] = (resultado[item.periodo] || 0) - item.monto;
  }

  return Object.keys(resultado).map((key) => ({
    id: key,
    valor: resultado[key],
  }));
}

// ============================================================
// 7) Préstamos pendientes
// ============================================================
export async function getPrestamosPendientesReporte(): Promise<
  {
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
  }[]
> {
  const ds = await getDb();
  const rows = await ds.getRepository(Prestamo).find({
    where: { eliminado: false, saldo: MoreThan(0) },
    relations: { personaDestino: true, personaOrigen: true, cuenta: true },
  });
  return rows.map((r) => ({
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
  }));
}

// ============================================================
// 8) Movimientos de tarjeta del período (no implementado en backend)
// ============================================================
export async function getMovimientosTarjetaPeriodo(
  _idTarjeta?: number
): Promise<null> {
  // No implementado en el backend original; devuelve null
  return null;
}

// ============================================================
// 9) Cuentas con evolución (sparkline del último mes)
// ============================================================
export async function getCuentasConEvolucion(): Promise<CuentaConEvolucion[]> {
  const ds = await getDb();
  const cuentas = await ds.getRepository(Cuenta).find({
    where: {
      eliminado: false,
      tipo: [{ nombre: "Cuenta Bancaria" }, { nombre: "Caja Fisica" }],
    },
    relations: { tipo: true },
  });

  const unMes = new Date();
  unMes.setMonth(unMes.getMonth() - 1);

  const result: CuentaConEvolucion[] = [];

  for (const cuenta of cuentas) {
    const historicos = await ds.getRepository(HistoricoCuenta).find({
      where: [
        {
          eliminado: false,
          cuenta: { nombre: cuenta.nombre },
          fechaHasta: MoreThanOrEqual(unMes),
        },
        {
          eliminado: false,
          cuenta: { nombre: cuenta.nombre },
          fechaHasta: IsNull(),
        },
      ],
    });

    const { vKeys, vValues } = filtrarMayorFechaPorDia(historicos);

    result.push({
      nombreCuenta: cuenta.nombre,
      saldoCuenta: cuenta.saldo,
      serieEjeX: vKeys,
      valoresEjeX: vValues,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helper: agrupa histórico por día tomando el último saldo de cada día
// ---------------------------------------------------------------------------
function filtrarMayorFechaPorDia(
  lista: { fechaHasta?: Date | null; fechaDesde: Date; saldo: number }[]
): { vKeys: string[]; vValues: number[] } {
  const agrupado: Record<string, number> = {};

  for (const item of lista) {
    const dia = item.fechaHasta
      ? item.fechaHasta.toISOString().split("T")[0]
      : item.fechaDesde.toISOString().split("T")[0];
    agrupado[dia] = item.saldo;
  }

  const entries = Object.entries(agrupado);
  return {
    vKeys: entries.map(([k]) => k),
    vValues: entries.map(([, v]) => v),
  };
}
