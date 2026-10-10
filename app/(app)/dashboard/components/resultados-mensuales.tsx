"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { claveMesDesdeEtiqueta } from "@/lib/mes-etiqueta";
import { cn, numberToCurrency } from "@/lib/utils";

/**
 * **Resultados mensuales** — el listado que se muestra debajo del carrusel de
 * Inicio cuando la tarjeta en foco es la del **Balance Actual** (2026-10-02).
 *
 * Es la contraparte "en grilla" del gráfico de Resultados: **una fila por mes**
 * con su resultado neto (ingresos − gastos), **del mes más actual al más
 * antiguo**. Reusa el **estilo de la grilla de movimientos** de una cuenta
 * (`MovimientoRow` / `MovimientosCuentaClient`): filas multilínea en mobile y
 * tabla en `sm+`, dentro del mismo recuadro `bg-card`.
 *
 * 🔑 La serie es la MISMA del panel **Resultados** (`data.evolucionResultados`),
 * así que el listado y el gráfico no pueden discrepar.
 *
 * ⚠️ Las etiquetas vienen del backend en formato **"mes-aaaa"** (`"sep-2026"`,
 * `etiquetaDesdeYM` en `backend/src/queries/reportes.ts`) y se muestran tal cual
 * —igual que en el eje del gráfico de Resultados—.
 */
export interface ResultadoMes {
  /** Etiqueta del mes tal como la da el backend (ej. `"sep-2026"`). */
  name: string;
  /** Resultado neto del mes (ingresos − gastos), en la moneda predeterminada. */
  value: number;
}

/**
 * Clave numérica `AAAAMM` a partir de la etiqueta `"mes-aaaa"`.
 *
 * ⚠️ Vive en **`lib/mes-etiqueta.ts`** junto con el orden **cronológico** del
 * gráfico (`dashboard-data.ts`): el listado y el gráfico tienen que ordenar con
 * el MISMO criterio.
 */

export function ResultadosMensuales({
  data,
  monedaISO,
}: {
  data: ResultadoMes[];
  /** ISO 4217 de la moneda (los resultados vienen en la predeterminada). */
  monedaISO: string;
}) {
  // **Del más actual al más antiguo** (pedido del usuario). El gráfico ordena al
  // revés (cronológico): el helper es el mismo para los dos.
  const filas = useMemo(
    () =>
      [...data].sort(
        (a, b) => claveMesDesdeEtiqueta(b.name) - claveMesDesdeEtiqueta(a.name)
      ),
    [data]
  );

  const colorResultado = (v: number) => (v < 0 ? "text-danger" : "text-success");

  const columns: ColumnDef<ResultadoMes>[] = [
    {
      accessorKey: "name",
      header: "Mes",
      cell: ({ getValue }) => (
        <span className="text-card-foreground">{String(getValue())}</span>
      ),
    },
    {
      accessorKey: "value",
      header: "Resultado",
      meta: { align: "right" } as const,
      cell: ({ getValue }) => {
        const v = Number(getValue<number>() ?? 0);
        return (
          <span className={cn("font-medium", colorResultado(v))}>
            {numberToCurrency(v, monedaISO)}
          </span>
        );
      },
    },
  ];

  /**
   * Título de la sección: **dentro del panel** (2026-10-03, «ningún título fuera
   * de los paneles») y sin negrita — la jerarquía la da el tamaño y el color.
   */
  const titulo = (
    <h2 className="text-[15.5px] text-header">Resultados mensuales</h2>
  );

  return (
    <>
      {filas.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-4">
          {titulo}
          <div className="flex h-32 items-center justify-center text-[13px] text-subtitle">
            Sin datos disponibles
          </div>
        </div>
      ) : (
        <>
          {/* ── MOBILE (<sm): mismas filas que los movimientos (sin swipe) ── */}
          <div className="sm:hidden">
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border px-3 py-2.5">{titulo}</div>
              <ul>
                {filas.map((f) => (
                  <li
                    key={f.name}
                    className="border-b border-border px-3 py-2.5 last:border-0"
                  >
                    <div className="flex items-center gap-2.5">
                      <p className="min-w-0 flex-1 truncate text-[13px] font-medium leading-4.25 text-card-foreground">
                        {f.name}
                      </p>
                      <p
                        className={cn(
                          "shrink-0 text-[15px] leading-4.75 tabular-nums",
                          colorResultado(f.value)
                        )}
                      >
                        {numberToCurrency(f.value, monedaISO)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* ── Desde sm (640px): la tabla ── */}
          <div className="hidden sm:block">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3">{titulo}</div>
              <DataTable columns={columns} data={filas} pageSize={20} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
