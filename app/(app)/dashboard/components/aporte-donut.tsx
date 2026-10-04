"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from "recharts";
import { numberToCurrency } from "@/lib/utils";
import type { AporteCuenta } from "../aportes-balance";
import { useHideTooltipOnTouch } from "./use-hide-tooltip-on-touch";

/**
 * **Donut del aporte por cuenta** — el gráfico de la tarjeta *Balance Actual* de
 * Inicio (2026-10-03).
 *
 * Es deliberadamente **mínimo**: sin leyenda, sin recuadro y sin total al centro
 * (el monto grande de la tarjeta es el **Balance**, no la suma de las cuentas, y
 * mostrarlo adentro confundiría). El **nombre y el % de cada cuenta viven en el
 * listado** de abajo (`aporte-cuentas-lista.tsx`), que usa **los mismos colores**
 * ⇒ el listado hace de leyenda.
 *
 * ⚠️ Un donut no puede representar aportes **negativos** (cuenta en rojo): se
 * pintan solo los positivos. El listado sí muestra todas las cuentas que aportan.
 */
export function AporteDonut({
  data,
  currency,
  height = 96,
}: {
  data: AporteCuenta[];
  /** ISO de la moneda en la que vienen los saldos (la predeterminada). */
  currency: string;
  height?: number;
}) {
  const touchReset = useHideTooltipOnTouch();
  const slices = data.filter((d) => d.value > 0);

  if (!slices.length) {
    return (
      <div
        className="flex items-center justify-center text-[13px] text-subtitle"
        style={{ height }}
      >
        No hay cuentas que aporten al balance.
      </div>
    );
  }

  return (
    <div
      onTouchStart={touchReset.onTouchStart}
      onTouchEnd={touchReset.onTouchEnd}
      onTouchCancel={touchReset.onTouchCancel}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<AporteTooltip currency={currency} />} />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="62%"
            outerRadius="94%"
            paddingAngle={2}
            // El hueco entre segmentos se pinta con el fondo de la banda.
            stroke="var(--muted)"
            strokeWidth={2}
            // ⚠️ SIN animación: el gráfico se re-monta al volver a la tarjeta.
            isAnimationActive={false}
          >
            {slices.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function AporteTooltip({
  active,
  payload,
  currency,
}: Partial<TooltipContentProps<number, string>> & { currency?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as AporteCuenta | undefined;
  if (!d) return null;
  return (
    <div className="rounded-lg bg-background/80 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="text-[12px] font-medium text-subtitle">{d.name}</p>
      <p className="mt-0.5 text-[16px] text-card-foreground">
        {numberToCurrency(d.value, currency)}
      </p>
      <p className="text-[11px] text-subtitle">
        {d.percent.toFixed(1).replace(/\.0$/, "")} % del aporte
      </p>
    </div>
  );
}
