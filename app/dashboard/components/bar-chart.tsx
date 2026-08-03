"use client";

import type { ReactNode } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";

interface BarChartProps {
  title: string;
  data: { name: string; value: number; value2?: number }[];
  bars: {
    key: string;
    name: string;
    color: string;
    darkColor: string;
  }[];
  height?: number;
  className?: string;
  action?: ReactNode;
  badge?: ReactNode;
}

export function StackedBarChart({
  title,
  data,
  bars,
  height = 300,
  className = "",
  action,
  badge,
}: BarChartProps) {
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
        <BarChart data={data} barGap={0} barCategoryGap="20%">
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
          <Tooltip cursor={false} content={<ChartTooltip />} />
          {bars.map((bar) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.name}
              fill={bar.color}
              radius={[4, 4, 0, 0]}
              stackId="a"
              activeBar={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
