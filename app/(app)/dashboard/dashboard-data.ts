import {
  getBalanceActual,
  getCuentasConEvolucion,
  getGastosPeriodo,
  getPrestamosPendientesReporte,
  getEvolucionGastos,
  getEvolucionIngresos,
  getEvolucionResultados,
} from "@/backend/src/queries/reportes";
import { getAllJornadasTrabajo } from "@/backend/src/queries/trabajos";
import { getAllPeriodosTrabajo, type PeriodoTrabajoOut } from "@/backend/src/queries/trabajos";
import type { GastoOut } from "@/backend/src/queries/gastos";
import { getAllGastos } from "@/backend/src/queries/gastos";
import { getSessionUser } from "@/backend/src/lib/auth";
import { numberToCurrency } from "@/lib/utils";

export interface DashboardData {
  balance: number;
  /** Código ISO de la moneda predeterminada del usuario (balance + sintéticas). */
  monedaPredeterminadaISO: string;
  cuentas: {
    id?: number;
    title: string;
    value: string;
    labels: string[];
    values: number[];
    /** Código ISO de la moneda de la cuenta (para el historial). */
    monedaISO?: string;
    /** Tarjeta sintética con menú de una sola acción (ej. Períodos Actuales → jornada). */
    menuAccion?: "jornada" | "cobro";
  }[];
  gastosResumen: {
    name: string;
    saldo: number;
    pagado: number;
  }[];
  gastosTotal: string;
  gastosSaldo: string;
  gastosDetalle: GastoOut[];
  ingresosDetalle: PeriodoTrabajoOut[];
  ingresosResumen: {
    name: string;
    value: number;
  }[];
  ingresosTotal: string;
  ingresosMesActual: string;
  /** Totales de préstamos pendientes por moneda (para el badge del gráfico). */
  prestamosTotales: { currency: string; value: string }[];
  /** Datos del gráfico de préstamos: una fila por persona; cada préstamo es un
   * segmento apilado y las monedas distintas generan barras agrupadas. */
  prestamosChart: {
    data: Record<string, string | number>[];
    series: { key: string; detalle: string; currency: string }[];
  };
  evolucionGastos: { name: string; value: number }[];
  evolucionIngresos: { name: string; value: number }[];
  evolucionResultados: { name: string; value: number }[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const [
    balance,
    cuentasEvol,
    gastosPeriodo,
    gastosTodos,
    prestamos,
    evolGastos,
    evolIngresos,
    evolResultados,
    jornadas,
    periodosTrabajo,
  ] = await Promise.all([
    getBalanceActual().catch(() => 0),
    getCuentasConEvolucion().catch(() => []),
    getGastosPeriodo().catch(() => [] as GastoOut[]),
    getAllGastos().catch(() => [] as GastoOut[]),
    getPrestamosPendientesReporte().catch(() => []),
    getEvolucionGastos().catch(() => []),
    getEvolucionIngresos().catch(() => []),
    getEvolucionResultados().catch(() => []),
    getAllJornadasTrabajo().catch(() => []),
    getAllPeriodosTrabajo().catch(() => []),
  ]);

  // Moneda predeterminada del usuario: se usa para formatear el balance actual
  // y las tarjetas sintéticas (Períodos a Cobrar/Actuales).
  const sessionUser = await getSessionUser();
  const monedaPredeterminadaISO =
    sessionUser?.monedaPredeterminada?.codigoISO ?? "USD";

  // --- Cuentas con evolución ---
  // `id` es opcional: las tarjetas sintéticas ("Períodos a Cobrar/Actuales")
  // no tienen cuenta real detrás y no deben abrir el historial al hacer click.
  const cuentas: {
    id?: number;
    title: string;
    value: string;
    labels: string[];
    values: number[];
    /** Código ISO de la moneda de la cuenta (para el historial). */
    monedaISO?: string;
    /** Tarjeta sintética con menú de una sola acción (ej. Períodos Actuales → jornada). */
    menuAccion?: "jornada" | "cobro";
  }[] = cuentasEvol.map((c) => ({
    id: c.id,
    title: c.nombreCuenta,
    value: numberToCurrency(c.saldoCuenta, c.monedaCodigoISO ?? "ARS"),
    labels: c.serieEjeX || [],
    values: c.valoresEjeX || [],
    monedaISO: c.monedaCodigoISO ?? "ARS",
  }));

  // Periodos pendientes de cobro (cerrados no cobrados)
  let pendienteCobro = 0;
  let periodosActuales = 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  periodosTrabajo.forEach((p) => {
    const fechaCobro = p.fechaDeCobro
      ? new Date(p.fechaDeCobro)
      : null;
    const fechaHasta = new Date(p.fechaHasta);
    const noCobrado =
      !fechaCobro || fechaCobro < new Date("1901-01-02");

    if (noCobrado && fechaHasta < now) {
      pendienteCobro += p.montoACobrar ?? 0;
    } else if (
      noCobrado &&
      fechaHasta >= now &&
      new Date(p.fechaDesde) <= now
    ) {
      periodosActuales += p.montoACobrar ?? 0;
    }
  });

  if (pendienteCobro > 0) {
    cuentas.push({
      title: "Períodos a Cobrar",
      value: numberToCurrency(pendienteCobro, monedaPredeterminadaISO),
      labels: [],
      values: [],
      // Menú con "Cobro Sueldo" (cobrar los períodos pendientes).
      menuAccion: "cobro",
    });
  }

  if (periodosActuales > 0) {
    cuentas.push({
      title: "Períodos Actuales",
      value: numberToCurrency(periodosActuales, monedaPredeterminadaISO),
      labels: [],
      values: [],
      // Menú con "Jornada trabajo" (agregar jornadas a los períodos actuales).
      menuAccion: "jornada",
    });
  }

  // --- Gastos por categoría ---
  const gastosMap = new Map<
    string,
    { saldo: number; pagado: number; total: number }
  >();
  let montoTotalGastos = 0;
  let montoSaldoGastos = 0;

  gastosPeriodo.forEach((g) => {
    const nombre = g.categoria?.nombre || "Sin categoría";
    const entry = gastosMap.get(nombre) || {
      saldo: 0,
      pagado: 0,
      total: 0,
    };
    entry.saldo += g.saldo;
    entry.pagado += g.monto - g.saldo;
    entry.total += g.monto;
    gastosMap.set(nombre, entry);
    montoTotalGastos += g.monto;
    montoSaldoGastos += g.saldo;
  });

  const gastosResumen = Array.from(gastosMap.entries()).map(
    ([name, data]) => ({
      name,
      saldo: data.saldo,
      pagado: data.pagado,
    })
  );

  // --- Ingresos por trabajo ---
  const ingresosMap = new Map<string, number>();
  let totalIngresos = 0;

  jornadas.forEach((j) => {
    const nombre = j.trabajo || "Sin trabajo";
    const monto = j.montoJornada + j.montoPropina;
    ingresosMap.set(nombre, (ingresosMap.get(nombre) || 0) + monto);
    totalIngresos += monto;
  });

  const ingresosResumen = Array.from(ingresosMap.entries()).map(
    ([name, value]) => ({ name, value })
  );

  // --- Ingresos del mes actual (jornadas cuya fechaJornada cae en el mes en curso) ---
  // Suma montojornada + montopropina de todos los registros de jornadatrabajo
  // filtrados por el mes actual.
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  let totalMesActual = 0;
  jornadas.forEach((j) => {
    // Mediodía UTC: evita que fechas a medianoche (UTC) se corran al día/mes
    // anterior en zonas horarias con offset negativo (p. ej. GMT-3).
    const f = new Date(j.fechaJornada);
    f.setUTCHours(12, 0, 0, 0);
    if (f >= inicioMes && f < finMes) {
      totalMesActual += j.montoJornada + j.montoPropina;
    }
  });

  // --- Préstamos pendientes (gráfico) ---
  // Barras agrupadas por persona; por cada moneda distinta se genera una barra
  // independiente, y los préstamos de la misma persona y moneda se apilan como
  // segmentos (cada préstamo = una serie, tooltip con detalle + monto).
  const prestamosPorPersona = new Map<
    string,
    Map<string, { detalle: string; monto: number; monedaISO: string }>
  >();
  prestamos.forEach((p) => {
    const nombre = p.personaDestino?.nombre || "Sin nombre";
    const monedaISO = p.monedaISO ?? "ARS";
    let persona = prestamosPorPersona.get(nombre);
    if (!persona) {
      persona = new Map();
      prestamosPorPersona.set(nombre, persona);
    }
    persona.set(`p-${p.id}`, {
      detalle: p.detalle || "Préstamo",
      monto: p.monto,
      monedaISO,
    });
  });

  // Todas las claves de préstamo: cada fila de persona lleva la misma forma
  // (Recharts alinea las barras por dataKey, con 0 donde no hay préstamo).
  const todasLasClaves = new Set<string>();
  prestamosPorPersona.forEach((persona) =>
    persona.forEach((_v, k) => todasLasClaves.add(k))
  );

  const prestamosChartData: Record<string, string | number>[] = [];
  const prestamosChartSeries: {
    key: string;
    detalle: string;
    currency: string;
  }[] = [];
  prestamosPorPersona.forEach((persona, nombre) => {
    const row: Record<string, string | number> = { name: nombre };
    todasLasClaves.forEach((k) => {
      row[k] = persona.get(k)?.monto ?? 0;
    });
    prestamosChartData.push(row);
  });
  // Orden estable de series: por moneda y luego por detalle.
  const prestamosOrdenados: {
    key: string;
    detalle: string;
    currency: string;
  }[] = [];
  prestamosPorPersona.forEach((persona) =>
    persona.forEach((v, k) =>
      prestamosOrdenados.push({
        key: k,
        detalle: v.detalle,
        currency: v.monedaISO,
      })
    )
  );
  prestamosOrdenados.sort(
    (a, b) =>
      a.currency.localeCompare(b.currency) ||
      a.detalle.localeCompare(b.detalle)
  );
  prestamosChartSeries.push(...prestamosOrdenados);

  // Totales por moneda para el badge (las barras mantienen su propia moneda).
  const totalPorMoneda = new Map<string, number>();
  prestamos.forEach((p) => {
    const monedaISO = p.monedaISO ?? "ARS";
    totalPorMoneda.set(
      monedaISO,
      (totalPorMoneda.get(monedaISO) || 0) + p.monto
    );
  });
  const prestamosTotales = Array.from(totalPorMoneda.entries()).map(
    ([currency, total]) => ({
      currency,
      value: numberToCurrency(total, currency),
    })
  );

  // --- Evolución ---
  const evolucionGastos = evolGastos.map((e) => ({
    name: e.periodo,
    value: e.monto,
  }));

  const evolucionIngresos = evolIngresos.map((e) => ({
    name: e.periodo,
    value: e.monto,
  }));

  // Evolución de resultados: usa el endpoint del backend getEvolucionResultados
  // (misma lógica que el frontend original: una sola serie con el resultado neto por mes)
  const evolucionResultados = evolResultados.map((e) => ({
    name: e.id,
    value: e.valor || 0,
  }));

  return {
    balance,
    monedaPredeterminadaISO,
    cuentas,
    gastosResumen,
    gastosTotal: numberToCurrency(montoTotalGastos, monedaPredeterminadaISO),
    gastosSaldo: numberToCurrency(montoSaldoGastos, monedaPredeterminadaISO),
    gastosDetalle: [...gastosTodos].sort((a, b) => {
      const fa = a.fechaPago ? new Date(a.fechaPago).getTime() : 0;
      const fb = b.fechaPago ? new Date(b.fechaPago).getTime() : 0;
      return fb - fa;
    }),
    ingresosDetalle: [...periodosTrabajo].sort(
      (a, b) =>
        new Date(b.fechaHasta).getTime() - new Date(a.fechaHasta).getTime()
    ),
    ingresosResumen,
    ingresosTotal: numberToCurrency(totalIngresos, monedaPredeterminadaISO),
    ingresosMesActual: numberToCurrency(totalMesActual, monedaPredeterminadaISO),
    prestamosTotales,
    prestamosChart: {
      data: prestamosChartData,
      series: prestamosChartSeries,
    },
    evolucionGastos,
    evolucionIngresos,
    evolucionResultados,
  };
}
