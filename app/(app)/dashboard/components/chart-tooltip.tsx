"use client";

import type { TooltipContentProps } from "recharts";
import { numberToCurrency } from "@/lib/utils";

/**
 * Tooltip compartido para gráficos (barras y líneas): muestra el nombre
 * (categoría/período) y el monto total en formato moneda.
 * En barras stacked suma todas las series (altura total de la barra), ya que
 * payload[0] es la serie del fondo de la pila (p. ej. "Pagado" = 0 en
 * préstamos pendientes) y no refleja el importe real.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  currency = "ARS",
}: Partial<TooltipContentProps<number, string>> & { currency?: string }) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((acc, p) => acc + (Number(p.value) || 0), 0);

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-[12px] font-medium text-subtitle">{label}</p>
      <p className="mt-0.5 text-[16px] font-semibold text-card-foreground">
        {numberToCurrency(total, currency)}
      </p>
    </div>
  );
}
