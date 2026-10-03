"use client";

import type { GastoOut } from "@/backend/src/queries/gastos";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";

interface GastoRowProps {
  gasto: GastoOut;
  /** ISO de la moneda en la que está `gasto.monto` (la predeterminada del usuario). */
  monedaISO: string;
}

/**
 * Fila multilínea de un gasto, para **MOBILE (<640px)** de la pantalla `/gastos`.
 *
 * Mismo formato que la fila del historial de una cuenta (`MovimientoRow`):
 * **siempre 2 líneas** y el importe en una **columna propia a la derecha** (no se
 * recorta nunca; lo que se recorta con `…` es la descripción).
 *
 *   · Línea 1 → descripción                        | importe.
 *   · Línea 2 → categoría · cuenta (con la que se pagó) | fecha de pago.
 *
 * La acción de la fila NO va en la fila: la revela el swipe (`SwipeRowActions`).
 */
export function GastoRow({ gasto, monedaISO }: GastoRowProps) {
  const pendiente = Number(gasto.saldo) > 0;
  const fecha = gasto.fechaPago
    ? dateTimeToString(gasto.fechaPago)
    : gasto.fechaVencimiento
      ? `vence ${dateTimeToString(gasto.fechaVencimiento)}`
      : "—";

  return (
    <li
      // Id de la fila en el DOM: es el puente con el swipe de la lista.
      data-row-id={gasto.id}
      className="border-b border-border px-3 py-2.5 last:border-0"
    >
      <div className="flex items-start gap-2.5">
        {/* Bloque de texto: puede encogerse (`min-w-0`), así la descripción se
            recorta con `…` en vez de empujar el ancho de la fila. */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-[13px] font-medium leading-4.25 text-card-foreground">
            {gasto.descripcion || "Sin descripción"}
          </p>
          <p className="truncate text-[11px] leading-3.5 text-subtitle">
            {[gasto.categoria?.nombre ?? "Sin categoría", gasto.cuenta]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {/* Columna de dinero: ancho propio, alineada a la derecha. */}
        <div className="shrink-0 space-y-0.5 text-right">
          <p className="text-[15px] leading-4.75 tabular-nums text-card-foreground">
            {numberToCurrency(Number(gasto.monto), monedaISO)}
          </p>
          <p className="whitespace-nowrap text-[11px] leading-3.5 tabular-nums text-subtitle">
            {fecha}
            {pendiente && <span className="text-danger"> · sin pagar</span>}
          </p>
        </div>
      </div>
    </li>
  );
}
