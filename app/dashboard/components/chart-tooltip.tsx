"use client";

import type { TooltipContentProps } from "recharts";
import { numberToCurrency } from "@/lib/utils";

/**
 * Tooltip compartido para gráficos (barras y líneas): muestra el nombre
 * (categoría/período) y el monto de la primera serie en formato moneda.
 */
export function ChartTooltip({
  active,
  payload,
  label,
}: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-[12px] font-medium text-subtitle">{label}</p>
      <p className="mt-0.5 text-[16px] font-semibold text-card-foreground">
        {numberToCurrency(Number(payload[0]?.value) || 0)}
      </p>
    </div>
  );
}
