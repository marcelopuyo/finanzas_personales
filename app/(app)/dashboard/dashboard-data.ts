import {
  getBalanceActual,
  getCuentasConEvolucion,
  getPrestamosPendientesReporte,
  getEvolucionIngresos,
  getEvolucionResultados,
} from "@/backend/src/queries/reportes";
import {
  getAllPeriodosTrabajo,
  type PeriodoTrabajoOut,
} from "@/backend/src/queries/trabajos";
import { ingresosDelMesActual, ingresosEnRango } from "./ingresos-helpers";
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
    /** Nombre del tipo de cuenta (para el icono de la tarjeta). */
    tipo?: string;
    /** Tarjeta sintética con menú de acción(es) (Actuales → jornada/tarea/período). */
    menuAccion?: ("jornada" | "cobro" | "tarea" | "periodo")[];
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
  /** Resultado (ingresos − gastos) del mes actual, formateado (FALLBACK SSR). */
  resultadosMesActual: string;
  /** Totales de préstamos pendientes por moneda (para el badge del gráfico). */
  prestamosTotales: { currency: string; value: string }[];
  /** Datos del gráfico de préstamos: una fila por persona; cada préstamo es un
   * segmento apilado y las monedas distintas generan barras agrupadas. */
  prestamosChart: {
    data: Record<string, string | number>[];
    series: { key: string; detalle: string; currency: string }[];
  };
  evolucionIngresos: { name: string; value: number }[];
  evolucionResultados: { name: string; value: number }[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const [
    balance,
    cuentasEvol,
    gastosTodos,
    prestamos,
    evolIngresos,
    evolResultados,
    periodosTrabajo,
  ] = await Promise.all([
    getBalanceActual().catch(() => 0),
    getCuentasConEvolucion().catch(() => []),
    getAllGastos().catch(() => [] as GastoOut[]),
    getPrestamosPendientesReporte().catch(() => []),
    getEvolucionIngresos().catch(() => []),
    getEvolucionResultados().catch(() => []),
    getAllPeriodosTrabajo().catch(() => []),
  ]);

  // Moneda predeterminada del usuario: se usa para formatear el balance actual
  // y las tarjetas sintéticas (Por cobrar/Actuales).
  const sessionUser = await getSessionUser();
  const monedaPredeterminadaISO =
    sessionUser?.monedaPredeterminada?.codigoISO ?? "USD";

  // --- Cuentas con evolución ---
  // `id` es opcional: las tarjetas sintéticas ("Por cobrar"/"Actuales")
  // se agregan en el cliente (dashboard-client.tsx) y no tienen cuenta real
  // detrás, así que no deben abrir el historial al hacer click.
  const cuentas: {
    id?: number;
    title: string;
    value: string;
    labels: string[];
    values: number[];
    /** Código ISO de la moneda de la cuenta (para el historial). */
    monedaISO?: string;
    /** Nombre del tipo de cuenta (para el icono de la tarjeta). */
    tipo?: string;
    /** Tarjeta sintética con menú de acción(es) (Actuales → jornada/tarea/período). */
    menuAccion?: ("jornada" | "cobro" | "tarea" | "periodo")[];
  }[] = cuentasEvol.map((c) => ({
    id: c.id,
    title: c.nombreCuenta,
    value: numberToCurrency(c.saldoCuenta, c.monedaCodigoISO ?? "ARS"),
    labels: c.serieEjeX || [],
    values: c.valoresEjeX || [],
    monedaISO: c.monedaCodigoISO ?? "ARS",
    tipo: c.tipoNombre ?? undefined,
  }));

  // Las tarjetas sintéticas "Por cobrar"/"Actuales" se calculan en el cliente
  // (dashboard-client.tsx) tras el montaje: el "hoy" del navegador
  // es el día real del usuario, mientras que el servidor podría correr en otra
  // zona horaria (ej. Vercel en UTC) y desfasarse ±1 día de noche.

  // --- Gastos del mes en curso (FALLBACK SSR del badge "Mes actual") ---
  // Ya no existe el "período de gasto": se toman los gastos PAGADOS (con
  // fechaPago) del mes calendario del servidor. El cliente recalcula el badge
  // con su fecha local tras el montaje (dashboard-client.tsx).
  const hoyServ = new Date();
  const desdeMes = `${hoyServ.getFullYear()}-${String(hoyServ.getMonth() + 1).padStart(2, "0")}-01`;
  const hastaMes = `${hoyServ.getFullYear()}-${String(hoyServ.getMonth() + 1).padStart(2, "0")}-${String(hoyServ.getDate()).padStart(2, "0")}`;
  const gastosMes = gastosTodos.filter((g) => {
    if (!g.fechaPago) return false;
    const f = String(g.fechaPago).slice(0, 10);
    return f >= desdeMes && f <= hastaMes;
  });

  let montoTotalGastos = 0;
  let montoSaldoGastos = 0;
  const gastosResumen = (() => {
    const map = new Map<string, { saldo: number; pagado: number }>();
    for (const g of gastosMes) {
      const nombre = g.categoria?.nombre || "Sin categoría";
      const e = map.get(nombre) || { saldo: 0, pagado: 0 };
      e.saldo += g.saldo;
      e.pagado += g.monto - g.saldo;
      map.set(nombre, e);
      montoTotalGastos += g.monto;
      montoSaldoGastos += g.saldo;
    }
    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      saldo: data.saldo,
      pagado: data.pagado,
    }));
  })();

  // --- Ingresos por trabajo (jornadas + tareas + prorrateo de fijo/horas_fijas) ---
  // ⚠️ Estos totales son solo el FALLBACK SSR; el dashboard los recalcula en el
  // cliente (dashboard-client.tsx) con la fecha local del navegador.
  const ingresosTotales = ingresosEnRango(periodosTrabajo);
  const ingresosResumen = Array.from(ingresosTotales.porTrabajo.entries()).map(
    ([name, value]) => ({ name, value })
  );
  const totalIngresos = ingresosTotales.total;

  // --- Ingresos del mes actual (jornadas cuya fechaJornada cae en el mes en curso) ---
  // Suma montojornada + montopropina de todos los registros de jornadatrabajo
  // filtrados por el mes actual. ⚠️ Este valor es solo el FALLBACK SSR: se
  // calcula con `new Date()` del servidor (Vercel en UTC) y, en el límite de
  // mes, puede quedar ±1 día/mes adelantado respecto al usuario (ej. GMT-3 de
  // noche el 31 → el server ya está en el 1° → 0). El badge "Mes actual" del
  // dashboard lo recalcula el cliente tras el montaje con la fecha local del
  // navegador (dashboard-client.tsx), mismo patrón que las tarjetas sintéticas.
  // --- Ingresos del mes actual (FALLBACK SSR; el cliente lo recalcula) ---
  // ⚠️ Solo fallback de SSR: se calcula con el "hoy" del servidor (Vercel en
  // UTC) y en el límite de mes puede quedar ±1 día/mes adelantado al usuario
  // (ej. GMT-3 de noche el 31 → el server ya está en el 1° → 0). El badge "Mes
  // actual" del dashboard lo recalcula el cliente tras el montaje con la fecha
  // local del navegador (dashboard-client.tsx), mismo patrón que las tarjetas
  // sintéticas.
  const hoy = new Date();
  const hoyKeyMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(hoy.getDate()).padStart(2, "0")}`;
  const totalMesActual = ingresosDelMesActual(periodosTrabajo, hoyKeyMes);

  // --- Resultado del mes actual (ingresos − gastos; FALLBACK SSR) ---
  // ⚠️ Igual que `ingresosMesActual`, es solo el fallback de SSR: se calcula
  // con `new Date()` del servidor (Vercel en UTC) y en el límite de mes puede
  // quedar ±1 día/mes adelantado al usuario. El badge "Mes actual" de
  // Resultados lo recalcula el cliente tras el montaje con la fecha local del
  // navegador (dashboard-client.tsx), usando la MISMA ventana que los badges
  // de Ingresos y Gastos (jornadas del mes − gastos con fechaPago en el mes)
  // para que la resta sea coherente con lo que muestran esos dos badges.
  const inicioKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  const hoyKey = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  let totalGastosMes = 0;
  gastosTodos.forEach((g) => {
    if (!g.fechaPago) return;
    const f = new Date(g.fechaPago).toISOString().slice(0, 10);
    if (f >= inicioKey && f <= hoyKey) totalGastosMes += g.monto;
  });
  const resultadosMesActual = numberToCurrency(
    totalMesActual - totalGastosMes,
    monedaPredeterminadaISO
  );

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
  // (La evolución de Gastos se calcula en el cliente por fecha de pago con la
  // agrupación elegida; ver gastos-agrupacion.ts. Acá solo Ingresos y Resultados.)
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
    resultadosMesActual,
    prestamosTotales,
    prestamosChart: {
      data: prestamosChartData,
      series: prestamosChartSeries,
    },
    evolucionIngresos,
    evolucionResultados,
  };
}
