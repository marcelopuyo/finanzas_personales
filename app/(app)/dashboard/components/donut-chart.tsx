"use client";

import type { ReactNode } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from "recharts";
import { numberToCurrency } from "@/lib/utils";

export interface DonutDatum {
  name: string;
  value: number;
  /** Desglose opcional (ej. Pagado/Pendiente en gastos) para el tooltip. */
  meta?: { label: string; value: number }[];
}

interface DonutChartProps {
  title: string;
  data: DonutDatum[];
  /** Código ISO para formatear los montos (default ARS). */
  currency?: string;
  className?: string;
  action?: ReactNode;
  badge?: ReactNode;
  /** Máximo de segmentos; los de menor monto se agrupan en "Otros". */
  maxSlices?: number;
}

/** Paleta para los segmentos: tonos 500, legibles en tema claro y oscuro. */
const PALETTE = [
  "var(--primary)",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#14b8a6",
];
const OTROS_COLOR = "#94a3b8";

interface Slice extends DonutDatum {
  color: string;
  percent: number;
}

/** Prepara los datos: quita montos 0, agrupa los menores en "Otros" y asigna
 * colores y porcentajes en orden descendente de monto. */
function buildSlices(data: DonutDatum[], maxSlices: number): Slice[] {
  const pos = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  if (!pos.length) return [];

  const top = maxSlices > 0 ? pos.slice(0, maxSlices - 1) : pos;
  const rest = maxSlices > 0 ? pos.slice(maxSlices - 1) : [];
  const total = pos.reduce((acc, d) => acc + d.value, 0);

  const slices: Slice[] = top.map((d, i) => ({
    ...d,
    color: PALETTE[i % PALETTE.length],
    percent: total > 0 ? (d.value / total) * 100 : 0,
  }));

  if (rest.length > 0) {
    const resto = rest.reduce((acc, d) => acc + d.value, 0);
    slices.push({
      name: "Otros",
      value: resto,
      meta: rest.map((d) => ({ label: d.name, value: d.value })),
      color: OTROS_COLOR,
      percent: total > 0 ? (resto / total) * 100 : 0,
    });
  }

  return slices;
}

function DonutTooltip({
  active,
  payload,
  currency,
}: Partial<TooltipContentProps<number, string>> & { currency?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as Slice | undefined;
  if (!d) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-[12px] font-medium text-subtitle">{d.name}</p>
      <p className="mt-0.5 text-[16px] font-semibold text-card-foreground">
        {numberToCurrency(d.value, currency)}
      </p>
      {d.meta && d.meta.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {d.meta.map((m) => (
            <div
              key={m.label}
              className="flex items-center justify-between gap-4 text-[12px]"
            >
              <span className="text-subtitle">{m.label}</span>
              <span className="font-medium text-card-foreground">
                {numberToCurrency(m.value, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DonutChart({
  title,
  data,
  currency,
  className = "",
  action,
  badge,
  maxSlices = 8,
}: DonutChartProps) {
  const header = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[16px] font-semibold text-header">{title}</h3>
        {badge}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );

  const slices = buildSlices(data, maxSlices);
  const total = slices.reduce((acc, s) => acc + s.value, 0);

  return (
    <div className={`rounded-lg border border-border bg-card p-5 ${className}`}>
      {header}
      {!slices.length ? (
        <div className="flex h-64 items-center justify-center text-[13px] text-subtitle">
          Sin datos disponibles
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
          {/* Donut */}
          <div className="relative h-56 w-full max-w-xs shrink-0 md:h-64 md:max-w-none md:flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<DonutTooltip currency={currency} />} />
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="68%"
                  outerRadius="92%"
                  paddingAngle={2}
                  stroke="var(--card)"
                  strokeWidth={2}
                >
                  {slices.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Total al centro */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] uppercase tracking-wide text-subtitle">
                Total
              </span>
              <span className="max-w-full truncate px-2 text-[17px] font-semibold text-header">
                {numberToCurrency(total, currency)}
              </span>
            </div>
          </div>

          {/* Leyenda */}
          <div className="w-full space-y-1.5 md:max-w-65 md:flex-1">
            {slices.map((s) => (
              <div
                key={s.name}
                className="flex items-center justify-between gap-3 text-[13px]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="truncate text-card-foreground">{s.name}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end leading-tight">
                  <span className="font-medium text-header">
                    {numberToCurrency(s.value, currency)}
                  </span>
                  <span className="text-[11px] text-subtitle">
                    {s.percent.toFixed(1).replace(/\.0$/, "")}%
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
