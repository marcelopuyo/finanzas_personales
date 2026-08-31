"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from "recharts";
import { cn, numberToCurrency } from "@/lib/utils";

export interface DonutDatum {
  name: string;
  value: number;
}

export interface DonutCompare {
  /** Total del período anterior (flecha del centro). */
  prevTotal: number;
  /** Monto del período anterior por nombre de segmento. */
  prevByName: Record<string, number>;
}

interface DonutChartProps {
  title: string;
  data: DonutDatum[];
  /** Código ISO para formatear los montos (default ARS). */
  currency?: string;
  className?: string;
  action?: ReactNode;
  badge?: ReactNode;
  /** Comparación vs el período anterior: muestra flechas de tendencia en el
   * total y en la leyenda (solo cuando se visualiza el mes actual). */
  compare?: DonutCompare | null;
  /** Invierte el color de las flechas de tendencia (verde si sube, rojo si baja).
   * Se usa en Ingresos, donde subir es bueno. Default: rojo sube / verde baja (Gastos). */
  invertTrend?: boolean;
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

interface Slice extends DonutDatum {
  color: string;
  percent: number;
}

/** Prepara los datos: quita montos 0 y asigna colores y porcentajes en orden
 * descendente de monto. Muestra TODOS los ítems, sin agrupar en "Otros". */
function buildSlices(data: DonutDatum[]): Slice[] {
  const pos = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const total = pos.reduce((acc, d) => acc + d.value, 0);

  return pos.map((d, i) => ({
    ...d,
    color: PALETTE[i % PALETTE.length],
    percent: total > 0 ? (d.value / total) * 100 : 0,
  }));
}

/** Flecha de tendencia: subió (rojo por defecto), bajó (verde por defecto) o se
 * mantuvo igual (gris). Con `invertTrend` (semántica de ingresos) se invierten
 * los colores: subió verde / bajó rojo. */
function TrendArrow({
  current,
  previous,
  invertTrend = false,
}: {
  current: number;
  previous: number;
  invertTrend?: boolean;
}) {
  if (current > previous) {
    return (
      <ArrowUp
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          invertTrend ? "text-success" : "text-danger"
        )}
        aria-label="Subió respecto al período anterior"
      />
    );
  }
  if (current < previous) {
    return (
      <ArrowDown
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          invertTrend ? "text-danger" : "text-success"
        )}
        aria-label="Bajó respecto al período anterior"
      />
    );
  }
  return (
    <Minus
      className="h-3.5 w-3.5 shrink-0 text-subtitle"
      aria-label="Se mantuvo igual respecto al período anterior"
    />
  );
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
    <div className="rounded-lg bg-background/80 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-[12px] font-medium text-subtitle">{d.name}</p>
      <p className="mt-0.5 text-[16px] font-semibold text-card-foreground">
        {numberToCurrency(d.value, currency)}
      </p>
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
  compare,
  invertTrend = false,
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

  const slices = buildSlices(data);
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
              <span className="flex max-w-full items-center gap-1 px-2">
                <span className="truncate text-[17px] font-semibold text-header">
                  {numberToCurrency(total, currency)}
                </span>
                {compare && (
                  <TrendArrow
                    current={total}
                    previous={compare.prevTotal}
                    invertTrend={invertTrend}
                  />
                )}
              </span>
              {compare && (
                <span className="text-[10px] text-subtitle">vs mes anterior</span>
              )}
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
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="flex flex-col items-end leading-tight">
                    <span className="font-medium text-header">
                      {numberToCurrency(s.value, currency)}
                    </span>
                    <span className="text-[11px] text-subtitle">
                      {s.percent.toFixed(1).replace(/\.0$/, "")}%
                    </span>
                  </span>
                  {compare && (
                    <TrendArrow
                      invertTrend={invertTrend}
                      current={s.value}
                      previous={compare.prevByName[s.name] ?? 0}
                    />
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
