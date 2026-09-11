"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { numberToCurrency } from "@/lib/utils";
import { fraseContraparte } from "@/lib/prestamos";
import { useHideTooltipOnTouch } from "./use-hide-tooltip-on-touch";

export interface PrestamoSerie {
  /** dataKey de la serie (una por préstamo). */
  key: string;
  /** Campo `detalle` del préstamo (se muestra en el tooltip). */
  detalle: string;
  /** ISO de la moneda del préstamo (agrupa en barras independientes). */
  currency: string;
  /** Sentido: `otorgado` (me deben → verde, hacia arriba) ·
      `obtenido` (yo debo → rojo, hacia abajo). */
  sentido: string;
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
 * el campo `detalle` de la base, su **saldo pendiente** en valor absoluto (en la
 * moneda del préstamo) y la dirección (*te debe* / *le debés*).
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
    .filter((p) => Number(p.value) !== 0)
    .map((p) => {
      const s = seriePorKey.get(String(p.dataKey));
      return {
        detalle: s?.detalle ?? String(p.name ?? p.dataKey ?? ""),
        // Los obtenidos vienen NEGATIVOS (barras hacia abajo): se muestran en
        // valor absoluto + la dirección en palabras.
        monto: Math.abs(Number(p.value) || 0),
        currency: s?.currency ?? "ARS",
        frase: fraseContraparte(s?.sentido ?? "otorgado"),
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
            <span className="text-right">
              <span className="font-medium text-card-foreground">
                {numberToCurrency(it.monto, it.currency)}
              </span>
              <span className="text-subtitle"> · {it.frase}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Gráfico de préstamos pendientes **divergente**: el eje X son las
 * CONTRAPARTES; por cada moneda distinta se dibuja una barra independiente
 * (agrupadas sobre la contraparte) y los préstamos de la misma contraparte y
 * moneda se apilan como segmentos.
 *
 * El **saldo pendiente** se grafica FIRMADO por el sentido: hacia ARRIBA y en
 * verde lo que ME DEBEN (otorgados), hacia ABAJO y en rojo lo que YO DEBO
 * (obtenidos) — con una línea de cero en el medio. Cada moneda tiene su PROPIO
 * eje Y con **dominio simétrico** (`[-max, max]`), así el cero queda siempre en
 * el medio y las dos zonas se leen igual en todas las monedas.
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
  // El tooltip se oculta al levantar el dedo en mobile (ver el hook).
  const touchReset = useHideTooltipOnTouch();
  const header = (
    <div className="relative mb-4 pr-8">
      {/* El título + badges pueden ocupar varias líneas en mobile; el menú (⋮)
          se ancla SIEMPRE al ángulo superior derecho del panel. */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[16px] font-semibold text-header">{title}</h3>
        {badge}
      </div>
      {/* Leyenda de las dos zonas del gráfico divergente (arriba/abajo). */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-subtitle">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: "var(--success)" }}
            aria-hidden="true"
          />
          me deben
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: "var(--danger)" }}
            aria-hidden="true"
          />
          yo debo
        </span>
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

  // Máximo ABSOLUTO por moneda (sumando los segmentos del mismo signo de cada
  // contraparte): define el dominio SIMÉTRICO `[-max, max]` de cada eje. Así el
  // cero queda siempre en el medio, la línea de cero es una sola en pantalla y
  // las zonas "me deben" (arriba) / "yo debo" (abajo) se leen igual con
  // cualquier moneda.
  const maxAbsPorMoneda = new Map<string, number>();
  data.forEach((row) => {
    const positivos = new Map<string, number>();
    const negativos = new Map<string, number>();
    series.forEach((s) => {
      const v = Number(row[s.key] ?? 0);
      if (v > 0) {
        positivos.set(s.currency, (positivos.get(s.currency) ?? 0) + v);
      } else if (v < 0) {
        negativos.set(s.currency, (negativos.get(s.currency) ?? 0) + -v);
      }
    });
    [...positivos, ...negativos].forEach(([currency, v]) => {
      maxAbsPorMoneda.set(currency, Math.max(maxAbsPorMoneda.get(currency) ?? 0, v));
    });
  });

  return (
    <div
      onTouchEnd={touchReset.onTouchEnd}
      onTouchCancel={touchReset.onTouchCancel}
      className={`rounded-lg border border-border bg-card p-5 ${className}`}
    >
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
              primera a la izquierda y el resto a la derecha. Dominio simétrico
              para que el cero quede en el medio. Los ticks van en valor
              ABSOLUTO (el signo lo da la zona del gráfico). */}
          {currencies.map((c, i) => (
            <YAxis
              key={c}
              yAxisId={c}
              orientation={i === 0 ? "left" : "right"}
              domain={[
                -(maxAbsPorMoneda.get(c) ?? 1),
                maxAbsPorMoneda.get(c) ?? 1,
              ]}
              tickFormatter={(v) => String(Math.abs(Number(v)))}
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
          {/* Línea de cero: separa "me deben" (arriba) de "yo debo" (abajo). */}
          <ReferenceLine
            y={0}
            yAxisId={currencies[0]}
            stroke="var(--border)"
          />
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
              // Verde lo que me deben (otorgado) · rojo lo que yo debo (obtenido).
              fill={s.sentido === "obtenido" ? "var(--danger)" : "var(--success)"}
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
