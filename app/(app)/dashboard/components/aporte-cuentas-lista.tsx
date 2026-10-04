"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { cn, numberToCurrency } from "@/lib/utils";
import type { AporteCuenta } from "../aportes-balance";

/**
 * **Listado del aporte por cuenta** — el panel que se ve debajo del carrusel de
 * Inicio cuando la tarjeta en foco es la de **Balance Actual** (2026-10-03).
 *
 * Una fila por cuenta que **suma al balance**, con su **saldo** (en la moneda
 * predeterminada) y el **% que aporta**, ordenadas **de mayor a menor**. El punto
 * de color de cada fila es el **mismo del donut** de la tarjeta ⇒ el listado hace
 * de leyenda.
 *
 * Reusa el estilo del listado de resultados mensuales / movimientos: filas
 * multilínea en mobile y tabla desde `sm`, dentro del recuadro `bg-card`.
 */
export function AporteCuentasLista({
  data,
  currency,
  onIrACuenta,
}: {
  data: AporteCuenta[];
  /** ISO de la moneda de los saldos (la predeterminada del usuario). */
  currency: string;
  /**
   * Tocar una fila **desplaza el carrusel** a la tarjeta de esa cuenta (pedido del
   * usuario, 2026-10-03). Si no se pasa, las filas no son interactivas.
   */
  onIrACuenta?: (cuentaId: number) => void;
}) {
  const monto = (v: number) => numberToCurrency(v, currency);
  const aporte = (p: number) => `${p.toFixed(1).replace(/\.0$/, "")} %`;

  const columns: ColumnDef<AporteCuenta>[] = [
    {
      accessorKey: "name",
      header: "Cuenta",
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: row.original.color }}
          />
          <span className="truncate text-card-foreground">
            {row.original.name}
          </span>
        </span>
      ),
    },
    {
      accessorKey: "value",
      header: "Saldo",
      meta: { align: "right" } as const,
      cell: ({ row }) => (
        <span
          className={cn(
            "font-medium tabular-nums",
            row.original.value < 0 ? "text-danger" : "text-card-foreground"
          )}
        >
          {monto(row.original.value)}
        </span>
      ),
    },
    {
      accessorKey: "percent",
      header: "Aporte",
      meta: { align: "right" } as const,
      cell: ({ row }) => (
        <span className="tabular-nums text-subtitle">
          {aporte(row.original.percent)}
        </span>
      ),
    },
  ];

  /**
   * ⚠️ **Sin título** (decisión del usuario, 2026-10-04): el listado va pelado — la
   * **barra de aporte** de la tarjeta de arriba ya dice de qué se trata. Si en algún
   * momento se quiere volver a rotular, el `h2` de los otros paneles es
   * `text-[15.5px] text-header`.
   */

  return (
    <>
      {data.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-border bg-card text-[13px] text-subtitle">
          Sin datos disponibles
        </div>
      ) : (
        <>
          {/* ── MOBILE (<sm): mismas filas que los movimientos ── */}
          <div className="sm:hidden">
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <ul>
                {data.map((c) => {
                  const id = c.id;
                  const irA =
                    id != null && onIrACuenta
                      ? () => onIrACuenta(id)
                      : undefined;
                  return (
                    <li key={c.name} className="border-b border-border last:border-0">
                      <button
                        type="button"
                        onClick={irA}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2.5 text-left",
                          irA && "transition-colors hover:bg-muted/40"
                        )}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        <p className="min-w-0 flex-1 truncate text-[13px] font-medium leading-4.25 text-card-foreground">
                          {c.name}
                        </p>
                        <div className="shrink-0 text-right">
                          <p
                            className={cn(
                              "text-[15px] leading-4.75 tabular-nums",
                              c.value < 0
                                ? "text-danger"
                                : "text-card-foreground"
                            )}
                          >
                            {monto(c.value)}
                          </p>
                          <p className="text-[11px] leading-3.5 tabular-nums text-subtitle">
                            {aporte(c.percent)}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* ── Desde sm (640px): la tabla ── */}
          <div className="hidden sm:block">
            <div className="rounded-lg border border-border bg-card p-4">
              <DataTable
                columns={columns}
                data={data}
                pageSize={20}
                getRowId={(r) => String(r.id ?? r.name)}
                onRowClick={
                  onIrACuenta
                    ? (r) => {
                        if (r.id != null) onIrACuenta(r.id);
                      }
                    : undefined
                }
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
