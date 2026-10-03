"use client";

import type { ReactNode } from "react";
import {
  LineChart,
  Line,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import { useHideTooltipOnTouch } from "./use-hide-tooltip-on-touch";

interface EvolutionChartProps {
  /** Título del panel. Opcional si se pasa `encabezado`. */
  title?: string;
  data: { name: string; value: number }[];
  color?: string;
  height?: number;
  className?: string;
  action?: ReactNode;
  badge?: ReactNode;
  area?: boolean;
  /** Código ISO para formatear el tooltip (default ARS). */
  currency?: string;
  /**
   * **Reemplaza TODO el encabezado del panel** (2026-10-01, `rediseno-ui`): el
   * rediseño deja dentro del panel solo su **selector de pestañas**, y el título,
   * el badge, los Filtros y el ⋯ pasan a una **fila suelta arriba de la pantalla**
   * (`dashboard-client.tsx`). Con `null` el panel no pinta ningún encabezado.
   */
  encabezado?: ReactNode;
  /**
   * **Sin el recuadro del panel** (fondo, borde y padding): lo usa la **banda de
   * Inicio** (2026-10-02), donde el gráfico va a sangre sobre el hero.
   */
  sinRecuadro?: boolean;
  /**
   * **Modo mínimo** (banda de Inicio): deja **solo la serie** — sin rótulos de
   * los ejes X/Y ni líneas horizontales de grilla (el tooltip sigue andando).
   */
  minimo?: boolean;
}

export function EvolutionChart({
  title,
  data,
  color = "var(--primary)",
  height = 300,
  className = "",
  action,
  badge,
  area = false,
  currency,
  encabezado,
  sinRecuadro = false,
  minimo = false,
}: EvolutionChartProps) {
  /** Wrapper: con `sinRecuadro` queda transparente (banda de Inicio). */
  const caja = sinRecuadro
    ? className
    : `rounded-lg border border-border bg-card p-5 ${className}`;
  // El tooltip se oculta al levantar el dedo en mobile (ver el hook).
  const touchReset = useHideTooltipOnTouch();
  const header =
    encabezado !== undefined ? (
      encabezado
    ) : (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      {/* En MOBILE este grupo ocupa todo el ancho del panel: así lo que se alinee
          a la derecha dentro del `badge` (hoy: el botón ⋯ del panel Gastos) queda
          pegado al borde superior derecho. En desktop vuelve a shrink-to-fit. */}
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <h3 className="text-[16px] text-header">{title}</h3>
        {badge}
      </div>
      {action && (
        // Mobile: el grupo ocupa todo el ancho del panel para que el botón ⋯
        // (que se pega al borde derecho con `ml-auto`) quede siempre en la
        // misma posición. En desktop vuelve a shrink-to-fit (a la derecha).
        <div className="flex w-full items-center gap-2 sm:w-auto">{action}</div>
      )}
    </div>
  );

  if (!data.length) {
    return (
      <div className={caja}>
        {header}
        <div
          className={`flex ${
            sinRecuadro ? "h-28" : "h-64"
          } items-center justify-center text-[13px] text-subtitle`}
        >
          Sin datos disponibles
        </div>
      </div>
    );
  }

  return (
    <div
      onTouchEnd={touchReset.onTouchEnd}
      onTouchCancel={touchReset.onTouchCancel}
      className={caja}
    >
      {header}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data}>
          {!minimo && (
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--border)"
            />
          )}
          <XAxis
            dataKey="name"
            hide={minimo}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            hide={minimo}
            // Con los ejes ocultos la serie toca los bordes: se le deja aire.
            padding={minimo ? { top: 12, bottom: 12 } : undefined}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip currency={currency} />} />
          {area ? (
            <>
              <defs>
                <linearGradient id="evolutionArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill="url(#evolutionArea)"
                dot={false}
                activeDot={{ r: 4, fill: color }}
              />
            </>
          ) : (
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: color }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

interface MultiLineChartProps {
  title: string;
  data: { name: string; ingresos: number; gastos: number; resultado: number }[];
  height?: number;
  className?: string;
  action?: ReactNode;
  badge?: ReactNode;
}

export function MultiLineChart({
  title,
  data,
  height = 300,
  className = "",
  action,
  badge,
}: MultiLineChartProps) {
  // El tooltip se oculta al levantar el dedo en mobile (ver el hook).
  const touchReset = useHideTooltipOnTouch();
  const header = (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h3 className="text-[16px] text-header">{title}</h3>
        {badge}
      </div>
      {action}
    </div>
  );

  if (!data.length) {
    return (
      <div className={`rounded-lg border border-border bg-card p-5 ${className}`}>
        {header}
        <div className="flex h-64 items-center justify-center text-[13px] text-subtitle">
          Sin datos disponibles
        </div>
      </div>
    );
  }

  return (
    <div
      onTouchEnd={touchReset.onTouchEnd}
      onTouchCancel={touchReset.onTouchCancel}
      className={`rounded-lg border border-border bg-card p-5 ${className}`}
    >
      {header}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--border)"
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "13px",
              color: "var(--card-foreground)",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="ingresos"
            name="Ingresos"
            stroke="var(--success)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="gastos"
            name="Gastos"
            stroke="var(--danger)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="resultado"
            name="Resultado"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
