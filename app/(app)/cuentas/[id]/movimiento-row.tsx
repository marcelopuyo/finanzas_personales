"use client";

import type { HistorialMovimientoOut } from "@/backend/src/queries/movimientos";
import { cn, dateTimeToString, numberToCurrency } from "@/lib/utils";

interface MovimientoRowProps {
  movimiento: HistorialMovimientoOut;
  /** ISO de la moneda de la cuenta (en la que están el monto y el saldo). */
  monedaISO: string;
  /** ISO de la moneda predeterminada del usuario (equivalente secundario). */
  monedaPredeterminadaISO: string;
  /**
   * Muestra el equivalente en la moneda predeterminada. Solo tiene sentido
   * cuando la moneda de la cuenta es DISTINTA (si coinciden, el equivalente es
   * igual al monto y no aporta nada).
   */
  mostrarEquivalente: boolean;
}

/**
 * Fila multilínea de un movimiento de la cuenta, para **MOBILE (<640px)**.
 *
 * Reemplaza la grilla de 5–6 columnas, que en el celular obligaba a scroll
 * horizontal (Fecha · Motivo · Monto · En tu moneda · Saldo · botón), por una
 * fila de **siempre 2 líneas** (diseño elegido 2026-09-20):
 *
 *   · Línea 1 → motivo (recortado con `…` si no entra) | MONTO en 15 px.
 *   · Línea 2 → fecha [+ `≈ equivalente`]               | saldo posterior.
 *
 * El monto y el saldo viven en una **columna propia a la derecha**: se comparan
 * de un vistazo entre filas y **nunca** se recortan. El que se recorta es el
 * motivo, así el alto de la fila no depende de lo largo del texto.
 *
 * La acción de la fila NO va en la fila (no hay columna de acciones): la revela
 * el swipe de la lista (`SwipeRowActions`), como en el resto de la app.
 */
export function MovimientoRow({
  movimiento,
  monedaISO,
  monedaPredeterminadaISO,
  mostrarEquivalente,
}: MovimientoRowProps) {
  const monto = Number(movimiento.monto);
  // Egreso → resta (rojo); cualquier otra categoría → suma (verde). Mismo
  // criterio que la tabla de escritorio.
  const esEgreso = (movimiento.categoria ?? "").toLowerCase() === "egreso";

  return (
    <li
      // Id de la fila en el DOM: es el puente con el swipe de la lista
      // (`SwipeRowActions` resuelve las acciones por este atributo).
      data-row-id={movimiento.id}
      className="border-b border-border px-3 py-2.5 last:border-0"
    >
      <div className="flex items-start gap-2.5">
        {/* Bloque de texto: puede encogerse (`min-w-0`), así el motivo se
            recorta con `…` en vez de empujar el ancho de la fila. */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-[13px] font-medium leading-4.25 text-card-foreground">
            {movimiento.motivo}
          </p>
          <p className="truncate text-[11px] leading-3.5 tabular-nums text-subtitle">
            {dateTimeToString(movimiento.fecha)}
            {mostrarEquivalente &&
              ` · ≈ ${numberToCurrency(
                Number(movimiento.montoPredeterminada),
                monedaPredeterminadaISO
              )}`}
          </p>
        </div>
        {/* Columna de dinero: ancho propio, alineada a la derecha. */}
        <div className="shrink-0 space-y-0.5 text-right">
          <p
            className={cn(
              "text-[15px] font-semibold leading-4.75 tabular-nums",
              esEgreso ? "text-danger" : "text-success"
            )}
          >
            {numberToCurrency(
              esEgreso ? -Math.abs(monto) : Math.abs(monto),
              monedaISO
            )}
          </p>
          <p className="whitespace-nowrap text-[11px] leading-3.5 tabular-nums text-subtitle">
            Saldo {numberToCurrency(Number(movimiento.saldoPosterior), monedaISO)}
          </p>
        </div>
      </div>
    </li>
  );
}
