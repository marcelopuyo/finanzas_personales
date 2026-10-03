"use client";

import type { TooltipContentProps } from "recharts";
import { etiquetaFechaTooltip, numberToCurrency } from "@/lib/utils";

/**
 * Tooltip compartido para gráficos (barras y líneas): muestra el nombre
 * (categoría/período) y el monto total en formato moneda.
 * En barras stacked suma todas las series (altura total de la barra), ya que
 * payload[0] es la serie del fondo de la pila (p. ej. "Pagado" = 0 en
 * préstamos pendientes) y no refleja el importe real.
 *
 * El rótulo es la etiqueta del eje X: cuando es una **fecha ISO** (las series
 * diarias, como la evolución de las cuentas) se muestra como `dd-mm-aa` (el
 * formato único de la app); los rótulos ya formateados (`sep-2026`, nombres de
 * cuenta, …) se dejan tal cual.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  currency = "ARS",
}: Partial<TooltipContentProps<number, string>> & { currency?: string }) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((acc, p) => acc + (Number(p.value) || 0), 0);
  const rotulo =
    typeof label === "string" ? etiquetaFechaTooltip(label) : label;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-[12px] font-medium text-subtitle">{rotulo}</p>
      <p className="mt-0.5 text-[16px] text-card-foreground">
        {numberToCurrency(total, currency)}
      </p>
    </div>
  );
}
