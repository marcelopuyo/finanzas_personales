import {
  getBalanceActual,
  getCuentasConEvolucion,
  getGastosPeriodo,
  getPrestmosPendientes,
  getEvolucionGastos,
  getEvolucionIngresos,
  getEvolucionResultados,
} from "@/lib/api/endpoints/reportes.api";
import { getAllJornadasTrabajoPlane } from "@/lib/api/endpoints/trabajos.api";
import { getAllPeriodosTrabajo } from "@/lib/api/endpoints/trabajos.api";
import type { GastoPeriodo, ResponsePeriodoTrabajoDto } from "@/types";
import { numberToCurrency, onlyDate } from "@/lib/utils";

export interface DashboardData {
  balance: number;
  cuentas: {
    title: string;
    value: string;
    labels: string[];
    values: number[];
  }[];
  gastosResumen: {
    name: string;
    saldo: number;
    pagado: number;
  }[];
  gastosTotal: string;
  gastosSaldo: string;
  gastosDetalle: GastoPeriodo[];
  ingresosDetalle: ResponsePeriodoTrabajoDto[];
  ingresosResumen: {
    name: string;
    value: number;
  }[];
  ingresosTotal: string;
  prestamosResumen: {
    name: string;
    saldo: number;
    pagado: number;
  }[];
  prestamosTotal: string;
  prestamosSaldo: string;
  evolucionGastos: { name: string; value: number }[];
  evolucionIngresos: { name: string; value: number }[];
  evolucionResultados: { name: string; value: number }[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const [
    balance,
    cuentasEvol,
    gastosPeriodo,
    prestamos,
    evolGastos,
    evolIngresos,
    evolResultados,
    jornadas,
    periodosTrabajo,
  ] = await Promise.all([
    getBalanceActual().catch(() => 0),
    getCuentasConEvolucion().catch(() => []),
    getGastosPeriodo().catch(() => []),
    getPrestmosPendientes().catch(() => []),
    getEvolucionGastos().catch(() => []),
    getEvolucionIngresos().catch(() => []),
    getEvolucionResultados().catch(() => []),
    getAllJornadasTrabajoPlane().catch(() => []),
    getAllPeriodosTrabajo().catch(() => []),
  ]);

  // --- Cuentas con evolución ---
  const cuentas = cuentasEvol.map((c) => ({
    title: c.nombreCuenta,
    value: numberToCurrency(c.saldoCuenta),
    labels: c.serieEjeX || [],
    values: c.valoresEjeX || [],
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
      pendienteCobro += p.montoACobrar;
    } else if (
      noCobrado &&
      fechaHasta >= now &&
      new Date(p.fechaDesde) <= now
    ) {
      periodosActuales += p.montoACobrar;
    }
  });

  if (pendienteCobro > 0) {
    cuentas.push({
      title: "Períodos a Cobrar",
      value: numberToCurrency(pendienteCobro),
      labels: [],
      values: [],
    });
  }

  if (periodosActuales > 0) {
    cuentas.push({
      title: "Períodos Actuales",
      value: numberToCurrency(periodosActuales),
      labels: [],
      values: [],
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

  // --- Préstamos pendientes ---
  const prestamosMap = new Map<
    string,
    { saldo: number; pagado: number; total: number }
  >();
  let montoTotalPrestamos = 0;
  let montoSaldoPrestamos = 0;

  prestamos.forEach((p) => {
    const nombre = p.personaDestino?.nombre || "Sin nombre";
    const entry = prestamosMap.get(nombre) || {
      saldo: 0,
      pagado: 0,
      total: 0,
    };
    entry.saldo += p.saldo;
    entry.pagado += p.monto - p.saldo;
    entry.total += p.monto;
    prestamosMap.set(nombre, entry);
    montoTotalPrestamos += p.monto;
    montoSaldoPrestamos += p.saldo;
  });

  const prestamosResumen = Array.from(prestamosMap.entries()).map(
    ([name, data]) => ({
      name,
      saldo: data.saldo,
      pagado: data.pagado,
    })
  );

  // --- Evolución ---
  const evolucionGastos = evolGastos.map((e) => ({
    name: e.periodo,
    value: e.monto || e.valor || 0,
  }));

  const evolucionIngresos = evolIngresos.map((e) => ({
    name: e.periodo,
    value: e.monto || e.valor || 0,
  }));

  // Evolución de resultados: usa el endpoint del backend getEvolucionResultados
  // (misma lógica que el frontend original: una sola serie con el resultado neto por mes)
  const evolucionResultados = evolResultados.map((e) => ({
    name: e.id,
    value: e.valor || 0,
  }));

  return {
    balance,
    cuentas,
    gastosResumen,
    gastosTotal: numberToCurrency(montoTotalGastos),
    gastosSaldo: numberToCurrency(montoSaldoGastos),
    gastosDetalle: [...gastosPeriodo].sort((a, b) => {
      const fa = a.fechaPago ? new Date(a.fechaPago).getTime() : 0;
      const fb = b.fechaPago ? new Date(b.fechaPago).getTime() : 0;
      return fb - fa;
    }),
    ingresosDetalle: [...periodosTrabajo].sort(
      (a, b) =>
        new Date(b.fechaHasta).getTime() - new Date(a.fechaHasta).getTime()
    ),
    ingresosResumen,
    ingresosTotal: numberToCurrency(totalIngresos),
    prestamosResumen,
    prestamosTotal: numberToCurrency(montoTotalPrestamos),
    prestamosSaldo: numberToCurrency(montoSaldoPrestamos),
    evolucionGastos,
    evolucionIngresos,
    evolucionResultados,
  };
}
