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
  Cell,
} from "recharts";

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
}

export function StackedBarChart({
  title,
  data,
  bars,
  height = 300,
  className = "",
  action,
}: BarChartProps) {
  const header = (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-[14px] font-medium text-header">{title}</h3>
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
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "13px",
              color: "var(--card-foreground)",
            }}
          />
          {bars.map((bar) => (
            <Bar
              key={bar.key}
              dataKey={bar.key}
              name={bar.name}
              fill={bar.color}
              radius={[4, 4, 0, 0]}
              stackId="a"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
