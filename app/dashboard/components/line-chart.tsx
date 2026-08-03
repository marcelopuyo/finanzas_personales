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

interface EvolutionChartProps {
  title: string;
  data: { name: string; value: number }[];
  color?: string;
  height?: number;
  className?: string;
  action?: ReactNode;
  badge?: ReactNode;
  area?: boolean;
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
}: EvolutionChartProps) {
  const header = (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h3 className="text-[16px] font-semibold text-header">{title}</h3>
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
    <div className={`rounded-lg border border-border bg-card p-5 ${className}`}>
      {header}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data}>
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
          <Tooltip content={<ChartTooltip />} />
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
  const header = (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h3 className="text-[16px] font-semibold text-header">{title}</h3>
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
    <div className={`rounded-lg border border-border bg-card p-5 ${className}`}>
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
