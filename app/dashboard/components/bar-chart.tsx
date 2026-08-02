"use client";

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
}

export function StackedBarChart({
  title,
  data,
  bars,
  height = 300,
  className = "",
}: BarChartProps) {
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
