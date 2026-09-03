"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { numberToCurrency } from "@/lib/utils";

export interface PrestamoSerie {
  /** dataKey de la serie (una por préstamo). */
  key: string;
  /** Campo `detalle` del préstamo (se muestra en el tooltip). */
  detalle: string;
  /** ISO de la moneda del préstamo (agrupa en barras independientes). */
  currency: string;
}

interface PrestamosChartProps {
  title: string;
  data: Record<string, string | number>[];
  series: PrestamoSerie[];
  height?: number;
  className?: string;
  badge?: ReactNode;
  /** Acción (menú) alineada a la derecha del encabezado del panel. */
  action?: ReactNode;
}

/**
 * Tooltip del gráfico de préstamos: por cada segmento (préstamo) activo muestra
 * el campo `detalle` de la base y su monto formateado en la moneda del préstamo.
 */
function PrestamosTooltip({
  active,
  payload,
  label,
  series,
}: Partial<TooltipContentProps<number, string>> & { series: PrestamoSerie[] }) {
  if (!active || !payload?.length) return null;
  const seriePorKey = new Map(series.map((s) => [s.key, s]));
  const items = payload
    .filter((p) => Number(p.value) > 0)
    .map((p) => {
      const s = seriePorKey.get(String(p.dataKey));
      return {
        detalle: s?.detalle ?? String(p.name ?? p.dataKey ?? ""),
        monto: Number(p.value) || 0,
        currency: s?.currency ?? "ARS",
      };
    });
  if (!items.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-[12px] font-medium text-subtitle">{label}</p>
      <div className="mt-1 space-y-0.5">
        {items.map((it, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-4 text-[12px]"
          >
            <span className="text-card-foreground">{it.detalle}</span>
            <span className="font-medium text-card-foreground">
              {numberToCurrency(it.monto, it.currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Gráfico de préstamos pendientes: el eje X son las personas; por cada moneda
 * distinta se dibuja una barra independiente (agrupadas sobre la persona), y
 * los préstamos de la misma persona y moneda se apilan como segmentos.
 * Cada moneda tiene su PROPIO eje Y (la primera a la izquierda y el resto a la
 * derecha) para que las barras de monedas con escalas dispares se vean completas.
 */
export function PrestamosChart({
  title,
  data,
  series,
  height = 300,
  className = "",
  badge,
  action,
}: PrestamosChartProps) {
  const header = (
    <div className="relative mb-4 pr-8">
      {/* El título + badges pueden ocupar varias líneas en mobile; el menú (⋮)
          se ancla SIEMPRE al ángulo superior derecho del panel. */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[16px] font-semibold text-header">{title}</h3>
        {badge}
      </div>
      {action && (
        <div className="absolute right-0 top-0 flex items-center">{action}</div>
      )}
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

  // Monedas presentes en los préstamos: un eje Y por moneda (orden alfabético,
  // la primera a la izquierda y el resto a la derecha).
  const currencies = Array.from(
    new Set(series.map((s) => s.currency))
  ).sort();

  return (
    <div className={`rounded-lg border border-border bg-card p-5 ${className}`}>
      {header}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} barGap={2} barCategoryGap="25%">
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
          {/* Un eje Y por moneda (cada moneda tiene su propia escala): la
              primera a la izquierda y el resto a la derecha. Así los préstamos
              de cada moneda se ven completos aunque las escalas difieran. */}
          {currencies.map((c, i) => (
            <YAxis
              key={c}
              yAxisId={c}
              orientation={i === 0 ? "left" : "right"}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={52}
              label={{
                value: c,
                angle: -90,
                position: i === 0 ? "insideLeft" : "insideRight",
                offset: 10,
                style: {
                  fontSize: 11,
                  fill: "var(--muted-foreground)",
                  fontWeight: 600,
                },
              }}
            />
          ))}
          <Tooltip
            cursor={false}
            content={<PrestamosTooltip series={series} />}
          />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.detalle}
              yAxisId={s.currency}
              stackId={s.currency}
              fill="var(--success)"
              stroke="var(--card)"
              strokeWidth={2}
              radius={[0, 0, 0, 0]}
              activeBar={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
