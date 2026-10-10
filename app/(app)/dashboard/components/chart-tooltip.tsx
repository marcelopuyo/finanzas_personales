"use client";

import type { TooltipContentProps } from "recharts";
import { cn, etiquetaFechaTooltip, numberToCurrency } from "@/lib/utils";

/** Una fila del tooltip **multi-serie** (ver `series`). */
export interface SerieTooltip {
  /**
   * `dataKey` de la serie en los datos del gráfico. La serie principal de
   * `EvolutionChart` es siempre `value`.
   */
  dataKey: string;
  /** Rótulo de la serie (el mismo de la leyenda). */
  label: string;
  /** Color del punto de la fila (el mismo del trazo). */
  color: string;
  /** La serie **principal** se muestra con más peso que las secundarias. */
  principal?: boolean;
}

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
 *
 * 🔢 Con **`series`** (2026-10-09, gráfico de Resultados) en vez del total se
 * lista **una fila por serie**: sumar las 3 cifras no significa nada, porque el
 * resultado **ya es** ingresos − gastos.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  currency = "ARS",
  series,
}: Partial<TooltipContentProps<number, string>> & {
  currency?: string;
  series?: SerieTooltip[];
}) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((acc, p) => acc + (Number(p.value) || 0), 0);
  const rotulo =
    typeof label === "string" ? etiquetaFechaTooltip(label) : label;

  const filas = series?.map((s) => ({
    ...s,
    valor:
      Number(
        payload.find((p) => String(p.dataKey) === s.dataKey)?.value
      ) || 0,
  }));

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-[12px] font-medium text-subtitle">{rotulo}</p>
      {filas ? (
        <div className="mt-1 space-y-0.5">
          {filas.map((f) => (
            <div key={f.dataKey} className="flex items-center gap-2">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: f.color }}
              />
              <span
                className={cn(
                  "text-[12px]",
                  f.principal
                    ? "font-medium text-card-foreground"
                    : "text-subtitle"
                )}
              >
                {f.label}
              </span>
              <span
                className={cn(
                  "ml-auto pl-3 tabular-nums",
                  f.principal
                    ? "text-[15px] text-card-foreground"
                    : "text-[13px] text-subtitle"
                )}
              >
                {numberToCurrency(f.valor, currency)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-0.5 text-[16px] text-card-foreground">
          {numberToCurrency(total, currency)}
        </p>
      )}
    </div>
  );
}
