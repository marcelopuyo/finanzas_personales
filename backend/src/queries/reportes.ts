import { Between, In, IsNull, LessThanOrEqual, MoreThan, MoreThanOrEqual } from "typeorm";
import { getDb } from "../db";
import { getSessionUser, requireUserId } from "../lib/auth";
import { convertir } from "../lib/cotizaciones";
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
  id: number;
  nombreCuenta: string;
  saldoCuenta: number;
  serieEjeX: string[];
  valoresEjeX: number[];
  /** Código ISO 4217 de la moneda de la cuenta (para formatear el saldo). */
  monedaCodigoISO: string | null;
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
  const userId = await requireUserId();
  const ds = await getDb();

  // Cuentas que el usuario marcó como parte del balance actual
  // (campo "Incluir en el balance actual" del CRUD de cuentas).
  const cuentas = await ds.getRepository(Cuenta).find({
    where: {
      usuario: { id: userId },
      eliminado: false,
      incluirEnBalance: true,
    },
    relations: { moneda: true },
  });

  // Moneda predeterminada del usuario: si una cuenta está en OTRA moneda, su
  // saldo se convierte a esta antes de sumarse al balance (via cotización).
  const sesion = await getSessionUser();
  const predeterminada = sesion?.monedaPredeterminada;
  const hoy = new Date();

  let saldoCajas = 0;
  for (const c of cuentas) {
    saldoCajas += await convertir(c.saldo, c.moneda, predeterminada, hoy);
  }

  // Gastos pendientes (saldo > 0)
  const gastos = await ds.getRepository(Gasto).find({
    where: { usuario: { id: userId }, eliminado: false, saldo: MoreThan(0) },
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
  const userId = await requireUserId();
  const ds = await getDb();
  const gastoRepo = ds.getRepository(Gasto);

  if (fechaDesde && fechaHasta) {
    const rows = await gastoRepo.find({
      where: {
        usuario: { id: userId },
        eliminado: false,
        fechaPago: Between(new Date(fechaDesde), new Date(fechaHasta)),
      },
      relations: { periodo: true, categoria: true },
    });
    return withCuentas(rows, ds);
  }

  let id = idPeriodo;
  if (!id) {
    // Se resuelve el período vigente con el "hoy" del servidor. Las columnas
    // son `date` (medianoche UTC), así que se compara con FECHAS INCLUSIVAS
    // usando el inicio/fin del día en UTC: antes, `fechaCierre >= now` (un
    // timestamp con hora) fallaba el MISMO día de cierre del período (p. ej.
    // el 31 si cierra el 31), dejando el badge "Mes actual" en 0. Además, el
    // servidor corre en UTC (Vercel) y en el límite de mes puede quedar ±1 día
    // adelantado al usuario (GMT-3 de noche el 31 → server ya en el 1°); el
    // cliente recalcula el badge con su fecha local tras el montaje.
    const hoyKey = new Date().toISOString().slice(0, 10);
    const inicioDia = new Date(`${hoyKey}T00:00:00.000Z`);
    const finDia = new Date(`${hoyKey}T23:59:59.999Z`);
    const actual = await ds.getRepository(PeriodoGasto).findOne({
      where: {
        usuario: { id: userId },
        eliminado: false,
        fechaApertura: LessThanOrEqual(finDia),
        fechaCierre: MoreThanOrEqual(inicioDia),
      },
    });
    if (!actual) return [];
    id = actual.id;
  }

  const rows = await gastoRepo.find({
    where: { usuario: { id: userId }, eliminado: false, periodo: { id } },
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
  const userId = await requireUserId();
  const ds = await getDb();
  // Cargamos gastos con su periodo y agrupamos manualmente (PeriodoGasto
  // no tiene la inversa gastos para evitar ciclos de importación).
  const gastos = await ds.getRepository(Gasto).find({
    where: { usuario: { id: userId }, eliminado: false },
    relations: { periodo: true },
  });

  const agrupado: Record<string, number> = {};
  for (const g of gastos) {
    const nombre = g.periodo?.nombre ?? "Sin período";
    agrupado[nombre] = (agrupado[nombre] || 0) + g.monto;
  }

  // Ordenamos por id del período para consistencia con el backend
  const periodos = await ds.getRepository(PeriodoGasto).find({
    where: { usuario: { id: userId }, eliminado: false },
    order: { id: "ASC" },
  });
  return periodos
    .filter((p) => agrupado[p.nombre] !== undefined)
    .map((p) => ({ periodo: p.nombre, monto: agrupado[p.nombre] ?? 0 }));
}

// ============================================================
// 4) Evolución de gastos mensual — desde MOVIMIENTOS (moneda predeterminada)
// ============================================================
export async function getEvolucionGastosMovimientos(): Promise<EvolucionItem[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const movs = await ds.getRepository(Movimiento).find({
    where: { cuenta: { usuario: { id: userId } }, eliminado: false },
    relations: { gasto: true },
  });

  const agrupado: Record<string, number> = {};
  for (const m of movs) {
    // Solo movimientos de gasto (Pago Gasto / Gasto Directo). `monto` ya está
    // en la moneda predeterminada del usuario (se convierte al guardarse),
    // aunque el movimiento se haya hecho en otra moneda.
    if (!m.gasto) continue;
    // Se agrupa por el MES DEL MOVIMIENTO (fecha de pago): el período del gasto
    // se corresponde con la fecha de pago (decisión 2026-08-10).
    const d = new Date(m.fecha);
    d.setUTCHours(12, 0, 0, 0);
    const mes = d.toLocaleDateString("es-ES", { month: "short" });
    const key = `${mes}-${d.getFullYear()}`;
    agrupado[key] = (agrupado[key] || 0) + m.monto;
  }

  return Object.entries(agrupado).map(([periodo, monto]) => ({ periodo, monto }));
}

// ============================================================
// 5) Evolución de ingresos (por mes, desde jornadas)
// ============================================================
export async function getEvolucionIngresos(): Promise<EvolucionItem[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const jornadas = await ds.getRepository(JornadaTrabajo).find({
    where: { periodoTrabajo: { trabajo: { usuario: { id: userId } } }, eliminado: false },
    order: { fechaJornada: "ASC" },
  });

  const agrupado: Record<string, number> = {};
  for (const j of jornadas) {
    // Mediodía UTC: evita que fechas a medianoche (UTC) se corran al día/mes
    // anterior en zonas horarias con offset negativo (p. ej. GMT-3).
    const d = new Date(j.fechaJornada);
    d.setUTCHours(12, 0, 0, 0);
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
    getEvolucionGastosMovimientos(),
  ]);

  // Ingresos (jornadas) y gastos (movimientos de gasto) ya están en la moneda
  // predeterminada del usuario (decisión 2026-08-10): las jornadas se cargan en
  // esa moneda y `movimiento.monto` se convierte al guardarse.
  const resultado: Record<string, number> = {};

  for (const item of ingresos) {
    resultado[item.periodo] = (resultado[item.periodo] || 0) + item.monto;
  }
  for (const item of gastos) {
    resultado[item.periodo] = (resultado[item.periodo] || 0) - item.monto;
  }

  // Solo se muestran los períodos que tienen gastos (se descartan los meses
  // sin gastos, que solo reflejarían ingresos sin contrapartida de gastos).
  const conGastos = new Set(
    gastos.filter((g) => g.monto > 0).map((g) => g.periodo)
  );

  return Object.keys(resultado)
    .filter((key) => conGastos.has(key))
    .map((key) => ({
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
    /** ISO de la moneda del préstamo (moneda de su cuenta). */
    monedaISO: string;
    personaOrigen: { nombre: string } | null;
    personaDestino: { nombre: string } | null;
    cuenta: { nombre: string } | null;
  }[]
> {
  const userId = await requireUserId();
  const ds = await getDb();
  const rows = await ds.getRepository(Prestamo).find({
    where: { usuario: { id: userId }, eliminado: false, saldo: MoreThan(0) },
    relations: {
      personaDestino: true,
      personaOrigen: true,
      cuenta: { moneda: true },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    detalle: r.detalle ?? null,
    fecha: r.fecha,
    monto: r.monto,
    saldo: r.saldo,
    cuotas: r.cuotas,
    sentido: r.sentido,
    monedaISO: r.cuenta?.moneda?.codigoISO ?? "ARS",
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
export async function getMovimientosTarjetaPeriodo(): Promise<null> {
  // No implementado en el backend original; devuelve null
  return null;
}

// ============================================================
// 9) Cuentas con evolución (sparkline del último mes)
// ============================================================
export async function getCuentasConEvolucion(): Promise<CuentaConEvolucion[]> {
  const userId = await requireUserId();
  const ds = await getDb();
  const cuentas = await ds.getRepository(Cuenta).find({
    where: {
      usuario: { id: userId },
      eliminado: false,
      tipo: [{ nombre: "Cuenta Bancaria" }, { nombre: "Caja Fisica" }],
    },
    relations: { tipo: true, moneda: true },
  });

  const unMes = new Date();
  unMes.setMonth(unMes.getMonth() - 1);

  const result: CuentaConEvolucion[] = [];

  for (const cuenta of cuentas) {
    // Se filtra por ID (NO por nombre): puede haber varias cuentas con el mismo
    // nombre (ej. dos "Billetera" en monedas distintas) y filtrar por nombre
    // mezclaría los históricos de todas ellas, corrompiendo la serie.
    const historicos = await ds.getRepository(HistoricoCuenta).find({
      where: [
        {
          eliminado: false,
          cuenta: { id: cuenta.id },
          fechaHasta: MoreThanOrEqual(unMes),
        },
        {
          eliminado: false,
          cuenta: { id: cuenta.id },
          fechaHasta: IsNull(),
        },
      ],
      // Orden cronológico: `historico_cuenta.id` es UUID (aleatorio), por lo
      // que sin ORDER BY la serie del sparkline llegaba barajada y podía
      // verse una tendencia ascendente cuando el saldo en realidad bajó.
      order: { fechaHasta: "ASC" },
    });

    const { vKeys, vValues } = filtrarMayorFechaPorDia(historicos);

    // Punto "hoy": con >= 2 snapshots el extremo derecho apunta al saldo actual
    // de la cuenta (coincide con la tarjeta). Con 0 o 1 movimiento la serie se
    // deja con un único punto para que el sparkline dibuje una línea horizontal:
    // - 0 movimientos -> único punto = saldo actual (línea en el saldo actual).
    // - 1 movimiento  -> se conserva el snapshot (línea en el valor del
    //   movimiento), sin reemplazarlo por el saldo de hoy.
    const hoyISO = new Date().toISOString().split("T")[0];
    if (vValues.length === 0) {
      vKeys.push(hoyISO);
      vValues.push(cuenta.saldo);
    } else if (vValues.length >= 2) {
      vValues[vValues.length - 1] = cuenta.saldo;
      vKeys[vKeys.length - 1] = hoyISO;
    }

    result.push({
      id: cuenta.id,
      nombreCuenta: cuenta.nombre,
      saldoCuenta: cuenta.saldo,
      serieEjeX: vKeys,
      valoresEjeX: vValues,
      monedaCodigoISO: cuenta.moneda?.codigoISO ?? null,
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
  // "Último saldo de cada día": por cada día se conserva el saldo del histórico
  // con la fecha MÁS reciente (mayor fechaHasta; NULL = vigente actual).
  const porDia = new Map<string, { saldo: number; fechaHastaMs: number }>();

  for (const item of lista) {
    const dia = item.fechaHasta
      ? item.fechaHasta.toISOString().split("T")[0]
      : item.fechaDesde.toISOString().split("T")[0];
    const fechaHastaMs = item.fechaHasta
      ? new Date(item.fechaHasta).getTime()
      : Number.MAX_SAFE_INTEGER; // vigente (NULL) = la más reciente
    const prev = porDia.get(dia);
    if (!prev || fechaHastaMs > prev.fechaHastaMs) {
      porDia.set(dia, { saldo: item.saldo, fechaHastaMs });
    }
  }

  // Orden cronológico: las fechas ISO "YYYY-MM-DD" ordenan igual que el
  // orden cronológico, así la tendencia del sparkline es la real.
  const entries = Array.from(porDia.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  return {
    vKeys: entries.map(([k]) => k),
    vValues: entries.map(([, v]) => v.saldo),
  };
}
