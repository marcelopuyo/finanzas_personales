"use client";

import { useState } from "react";
import type { MouseEvent } from "react";
import { numberToCurrency } from "@/lib/utils";

interface SparkLineChartProps {
  data: number[];
  labels?: string[];
  variant?: "line" | "bar";
}

interface TooltipState {
  left: number;
  top: number;
  label?: string;
  value: number;
}

export function SparkLineChart({
  data,
  labels,
  variant = "line",
}: SparkLineChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  if (!data || data.length === 0) return null;

  const width = 200;
  const height = 40;
  const padding = 2;

  const showBarTooltip = (e: MouseEvent<SVGRectElement>, index: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      left: rect.left + rect.width / 2,
      top: rect.top,
      label: labels?.[index],
      value: data[index],
    });
  };

  const tooltipNode = tooltip ? (
    <div
      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-card px-2 py-1 shadow-lg"
      style={{ left: tooltip.left, top: tooltip.top - 4 }}
    >
      {tooltip.label && (
        <p className="text-[10px] leading-tight text-subtitle">
          {tooltip.label}
        </p>
      )}
      <p className="text-[11px] font-semibold leading-tight text-card-foreground">
        {numberToCurrency(tooltip.value)}
      </p>
    </div>
  ) : null;

  // Variante de barras (mini columnas proporcionales con tooltip por barra)
  if (variant === "bar") {
    const max = Math.max(...data);
    const usableWidth = width - padding * 2;
    const slot = usableWidth / data.length;
    const barWidth = Math.max(slot * 0.6, 1);
    const chartHeight = height - padding * 2;

    const bars = data.map((value, index) => {
      const barHeight = max > 0 ? (value / max) * chartHeight : 0;
      const x = padding + index * slot + (slot - barWidth) / 2;
      const y = height - padding - barHeight;
      return (
        <rect
          key={index}
          x={x}
          y={y}
          width={barWidth}
          height={barHeight}
          rx={Math.min(barWidth / 2, 2)}
          fill="var(--primary)"
          onMouseEnter={(e) => showBarTooltip(e, index)}
          onMouseLeave={() => setTooltip(null)}
        />
      );
    });

    return (
      <>
        {tooltipNode}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-10 w-full overflow-visible"
          preserveAspectRatio="none"
        >
          {bars}
        </svg>
      </>
    );
  }

  // Variante de línea (necesita al menos 2 puntos)
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const y =
        height -
        padding -
        ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const isPositive = data[data.length - 1] >= data[0];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-10 w-full overflow-visible"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke={isPositive ? "var(--success)" : "var(--danger)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
