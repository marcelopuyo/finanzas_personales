"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface EvolutionChartProps {
  title: string;
  data: { name: string; value: number }[];
  color?: string;
  height?: number;
  className?: string;
}

export function EvolutionChart({
  title,
  data,
  color = "var(--primary)",
  height = 300,
  className = "",
}: EvolutionChartProps) {
  if (!data.length) {
    return (
      <div className={`rounded-lg border border-[#3e3f42] bg-[#353638] p-5 ${className}`}>
        <h3 className="mb-4 text-[14px] font-medium text-[#ffffff]">{title}</h3>
        <div className="flex h-64 items-center justify-center text-[13px] text-[#808185]">
          Sin datos disponibles
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-[#3e3f42] bg-[#353638] p-5 ${className}`}>
      <h3 className="mb-4 text-[14px] font-medium text-[#ffffff]">{title}</h3>
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
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface MultiLineChartProps {
  title: string;
  data: { name: string; ingresos: number; gastos: number; resultado: number }[];
  height?: number;
  className?: string;
}

export function MultiLineChart({
  title,
  data,
  height = 300,
  className = "",
}: MultiLineChartProps) {
  if (!data.length) {
    return (
      <div className={`rounded-lg border border-[#3e3f42] bg-[#353638] p-5 ${className}`}>
        <h3 className="mb-4 text-[14px] font-medium text-[#ffffff]">{title}</h3>
        <div className="flex h-64 items-center justify-center text-[13px] text-[#808185]">
          Sin datos disponibles
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-[#3e3f42] bg-[#353638] p-5 ${className}`}>
      <h3 className="mb-4 text-[14px] font-medium text-[#ffffff]">{title}</h3>
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
