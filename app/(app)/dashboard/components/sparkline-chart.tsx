"use client";

import { useId, useState } from "react";
import type { MouseEvent, TouchEvent } from "react";
import { numberToCurrency } from "@/lib/utils";

interface SparkLineChartProps {
  data: number[];
  labels?: string[];
  variant?: "line" | "bar";
  /** Código ISO de la moneda de los valores (formatea el tooltip). */
  currency?: string;
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
  currency = "ARS",
}: SparkLineChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const gradientId = useId().replace(/:/g, "");

  if (!data || data.length === 0) return null;

  const width = 200;
  const height = 40;
  const padding = 2;

  const showTooltipAt = (
    e: MouseEvent<SVGElement> | TouchEvent<SVGElement>,
    index: number
  ) => {
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
        {numberToCurrency(tooltip.value, currency)}
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

    // Soporte táctil (móvil): al deslizar el dedo sobre las barras se muestra
    // el tooltip de la barra que queda debajo del dedo, igual que el hover en
    // desktop. El touchstart/move se manejan a nivel del <svg>.
    const handleBarTouch = (e: TouchEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = e.touches[0]?.clientX ?? 0;
      const frac = (clientX - rect.left) / rect.width;
      const index = Math.max(
        0,
        Math.min(data.length - 1, Math.floor(frac * data.length))
      );
      const barCenterX = padding + index * slot + slot / 2;
      setTooltip({
        left: rect.left + (barCenterX / width) * rect.width,
        top: rect.top,
        label: labels?.[index],
        value: data[index],
      });
    };

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
          onMouseEnter={(e) => showTooltipAt(e, index)}
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
          onTouchStart={handleBarTouch}
          onTouchMove={handleBarTouch}
          onTouchEnd={() => setTooltip(null)}
        >
          {bars}
        </svg>
      </>
    );
  }

  // Variante de línea: con un único punto dibuja una línea recta horizontal en
  // ese valor (caso "0 o 1 movimiento" en las tarjetas de cuenta); con 2+ puntos
  // traza la tendencia. Tooltip en todo el área.
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const toY = (value: number) =>
    height -
    padding -
    ((value - min) / range) * (height - padding * 2);

  // Con un único punto: dos puntos virtuales a los extremos a la misma altura
  // -> polyline = línea recta horizontal en el valor del punto.
  const linePoints =
    data.length === 1
      ? [
          { x: padding, y: toY(data[0]) },
          { x: width - padding, y: toY(data[0]) },
        ]
      : data.map((value, index) => {
          const x =
            padding + (index / (data.length - 1)) * (width - padding * 2);
          const y = toY(value);
          return { x, y };
        });

  const points = linePoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Relleno (área/sombra) bajo la línea, estilo los gráficos históricos: cierra
  // el contorno desde la línea hasta la base del gráfico con un gradiente
  // vertical (más opaco arriba → transparente abajo).
  const areaPath =
    `M ${linePoints[0].x},${linePoints[0].y}` +
    linePoints
      .slice(1)
      .map((p) => ` L ${p.x},${p.y}`)
      .join("") +
    ` L ${linePoints[linePoints.length - 1].x},${height}` +
    ` L ${linePoints[0].x},${height} Z`;

  // Soporta mouse (onMouseMove) y dedo en móvil (onTouchStart/onTouchMove): el
  // tooltip se actualiza según la posición horizontal sobre el gráfico.
  const handleMove = (
    e: MouseEvent<SVGSVGElement> | TouchEvent<SVGSVGElement>
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX =
      "touches" in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
    const frac = (clientX - rect.left) / rect.width;
    const index = Math.max(
      0,
      Math.min(data.length - 1, Math.round(frac * (data.length - 1)))
    );
    // Con un único punto el tooltip se centra (no se apoya en el borde
    // izquierdo); en los demás casos sigue la posición horizontal del puntero.
    const point =
      data.length === 1
        ? { x: width / 2, y: linePoints[0].y }
        : linePoints[index];
    setTooltip({
      left: rect.left + (point.x / width) * rect.width,
      top: rect.top + (point.y / height) * rect.height,
      label: labels?.[index],
      value: data[index],
    });
  };

  return (
    <>
      {tooltipNode}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-10 w-full overflow-visible"
        preserveAspectRatio="none"
        onMouseMove={handleMove}
        onMouseLeave={() => setTooltip(null)}
        onTouchStart={handleMove}
        onTouchMove={handleMove}
        onTouchEnd={() => setTooltip(null)}
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0"
            y1="0"
            x2="0"
            y2={height}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="var(--success)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <polyline
          points={points}
          fill="none"
          stroke="var(--success)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </>
  );
}
