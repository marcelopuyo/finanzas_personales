"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import { useHideTooltipOnTouch } from "./use-hide-tooltip-on-touch";

/**
 * **Aporte al balance por cuenta** (2026-10-02, rama `rediseno-ui`).
 *
 * Es el gráfico que se pinta debajo del carrusel **cuando la tarjeta en foco es
 * la de *Balance Actual*** (índice 0): una barra por **cuenta que suma al
 * balance**, con el saldo de cada una **convertido a la moneda predeterminada
 * del usuario** (`saldoPredeterminado` en `DashboardData.cuentas`), así las
 * barras de cuentas en monedas distintas son comparables entre sí.
 *
 * ⚠️ **Las barras NO suman exactamente el monto de la tarjeta**: `getBalanceActual()`
 * resta además los **gastos pendientes** (saldo > 0) y, si el usuario activó el
 * switch, suma el **neto de préstamos**. El gráfico muestra solo la parte
 * "cuentas" (decisión de diseño: una barra = una cuenta, como pidió el usuario).
 *
 * El panel va **sin encabezado** (`p-5` + gráfico), igual que los gráficos de las
 * tarjetas de cuenta: el nombre de la cuenta vive en el eje X, no dentro del panel.
 */
export interface BarraCuenta {
  /** Nombre de la cuenta (rótulo del eje X). */
  name: string;
  /** Saldo en la moneda predeterminada del usuario. */
  value: number;
}

interface BalanceBarrasChartProps {
  data: BarraCuenta[];
  /** ISO de la moneda de los saldos (la predeterminada del usuario). */
  currency: string;
  height?: number;
  className?: string;
  /** Sin el recuadro del panel (lo usa la banda de Inicio). */
  sinRecuadro?: boolean;
  /**
   * **Modo mínimo** (banda de Inicio): solo las barras — sin rótulos de los ejes
   * X/Y ni líneas horizontales de grilla (el tooltip sigue andando).
   */
  minimo?: boolean;
  /** Color de las barras (default: el primario de la app). */
  color?: string;
}

/**
 * Rótulo del eje X con **ajuste de línea**: los nombres de cuenta ("Cuenta Truist
 * USD") no entran en el ancho de una barra en mobile, así que se parten en hasta
 * 3 líneas de ~11 caracteres. El nombre COMPLETO sigue apareciendo en el tooltip.
 */
function RotuloCuenta({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: unknown };
}) {
  const palabras = String(payload?.value ?? "")
    // Una palabra sola más larga que el ancho de la banda no se puede partir:
    // se corta con "…" para que no pise el rótulo de la barra vecina.
    .split(/\s+/)
    .map((p) => (p.length > 12 ? `${p.slice(0, 11)}…` : p));
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    if (!actual) {
      actual = palabra;
    } else if (`${actual} ${palabra}`.length <= 11) {
      actual = `${actual} ${palabra}`;
    } else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);

  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      {lineas.slice(0, 3).map((linea, i) => (
        <text
          key={i}
          x={0}
          y={0}
          dy={11 + i * 10}
          textAnchor="middle"
          fontSize={9}
          fill="var(--muted-foreground)"
        >
          {linea}
        </text>
      ))}
    </g>
  );
}

export function BalanceBarrasChart({
  data,
  currency,
  height = 170,
  className = "",
  sinRecuadro = false,
  minimo = false,
  color = "var(--primary)",
}: BalanceBarrasChartProps) {
  /** Wrapper: con `sinRecuadro` queda transparente (banda de Inicio). */
  const caja = sinRecuadro
    ? className
    : `rounded-2xl border border-border bg-card p-5 ${className}`;
  // El tooltip se oculta al levantar el dedo en mobile (ver el hook).
  const touchReset = useHideTooltipOnTouch();

  if (!data.length) {
    return (
      <div className={caja}>
        <p className="text-[13px] text-subtitle">
          No hay cuentas que aporten al balance actual.
        </p>
      </div>
    );
  }

  return (
    <div
      onTouchStart={touchReset.onTouchStart}
      onTouchEnd={touchReset.onTouchEnd}
      onTouchCancel={touchReset.onTouchCancel}
      className={caja}
    >
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={
            minimo
              ? { top: 8, right: 4, bottom: 4, left: 4 }
              : { top: 4, right: 4, bottom: 0, left: -12 }
          }
        >
          {!minimo && (
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--border)"
            />
          )}
          {/* `height` = alto reservado para las hasta 3 líneas del rótulo. */}
          <XAxis
            dataKey="name"
            hide={minimo}
            height={40}
            interval={0}
            tick={<RotuloCuenta />}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            hide={minimo}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={54}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            content={<ChartTooltip currency={currency} />}
          />
          {/* ⚠️ SIN animación de entrada: este gráfico **se remonta en cada swipe**
              del carrusel (la tarjeta en foco cambia), así que la animación
              reproduciría el "crecer desde cero" cada vez. */}
          <Bar
            dataKey="value"
            fill={color}
            radius={[6, 6, 0, 0]}
            maxBarSize={44}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
