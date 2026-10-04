import type { DashboardData } from "./dashboard-data";
import { DONUT_PALETTE } from "./components/donut-chart";

/** Una cuenta que aporta al Balance Actual, con su parte del total. */
export interface AporteCuenta {
  /** Nombre de la cuenta (rótulo del donut y de la lista). */
  name: string;
  /** Saldo en la **moneda predeterminada** del usuario. */
  value: number;
  /** Aporte sobre el **total de las cuentas que aportan** (0-100). */
  percent: number;
  /** Color del segmento: el **mismo** en el donut y en el listado. */
  color: string;
}

/**
 * **Aporte de cada cuenta al Balance Actual** (2026-10-03) — alimenta el **donut**
 * de la tarjeta *Balance Actual* de Inicio y su **listado** de abajo.
 *
 * 🔑 Reglas (decisión del usuario):
 * - Solo las cuentas que **suman** al balance (`aportaAlBalance`, el switch
 *   "Incluir en el balance actual" del CRUD de cuentas).
 * - El **denominador es la suma de esas cuentas**, no el monto de la tarjeta: así
 *   los porcentajes suman 100 % y el donut cierra. ⚠️ El Balance de la tarjeta
 *   **no** coincide con esa suma porque `getBalanceActual()` además **resta los
 *   gastos pendientes** (saldo > 0) y, si el usuario activó el switch, **suma el
 *   neto de préstamos** (mismo matiz que documentaba el gráfico de barras previo).
 * - Orden **de mayor a menor** saldo (pedido del usuario).
 * - Color por **posición** en la lista (`DONUT_PALETTE`), compartido donut ↔ listado.
 *
 * ℹ️ Los saldos ya vienen convertidos a la moneda predeterminada
 * (`saldoPredeterminado`), así cuentas de monedas distintas son comparables.
 */
export function calcularAportes(
  cuentas: DashboardData["cuentas"]
): AporteCuenta[] {
  const queAportan = cuentas
    .filter((c) => c.aportaAlBalance)
    .map((c) => ({ name: c.title, value: c.saldoPredeterminado }))
    .sort((a, b) => b.value - a.value);

  const total = queAportan.reduce((acc, c) => acc + c.value, 0);

  return queAportan.map((c, i) => ({
    ...c,
    percent: total > 0 ? (c.value / total) * 100 : 0,
    color: DONUT_PALETTE[i % DONUT_PALETTE.length],
  }));
}
