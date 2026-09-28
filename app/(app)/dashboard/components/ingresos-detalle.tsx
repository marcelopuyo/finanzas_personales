"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import type { LiquidacionOut } from "@/backend/src/queries/trabajos";
import { cn, dateTimeToString, numberToCurrency } from "@/lib/utils";
import { SparkLineChart } from "./sparkline-chart";

function formatCobroDate(value?: string | Date): string {
  if (!value) return "—";
  const d = new Date(value);
  if (d.getFullYear() < 1901) return "—";
  return dateTimeToString(d);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Formatea un instante (fecha/hora efectiva de una tarea) a "dd/mm hh:mm" LOCAL. */
function fechaHoraLabel(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/**
 * Importe de la fila: **sólo el monto COBRADO** (2026-09-27). Antes, si el cobro
 * había diferido del calculado, aparecía abajo un "calc. …" con lo que
 * correspondía: se quitó por pedido del usuario (la fila queda más limpia).
 * El `montoCalculado` se conserva únicamente como **respaldo** por si una
 * liquidación no tuviera cobro (en el modelo nuevo nacen cobradas).
 */
function ImporteCell({
  montoCobrado,
  montoCalculado,
  fechaDeCobro,
  propina,
  currency,
}: {
  montoCobrado: number | null;
  montoCalculado: number | null;
  fechaDeCobro?: string | Date | null;
  /** Propina de las jornadas de la liquidación (0 si no tiene). */
  propina: number;
  currency: string;
}) {
  const cobrado =
    !!fechaDeCobro && new Date(fechaDeCobro).getFullYear() >= 1901;
  const monto = (cobrado ? montoCobrado : null) ?? montoCalculado ?? 0;
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span
        className={cn(
          "inline-flex min-w-22 flex-col items-end rounded-full px-2 py-0.5 text-[12px] font-medium",
          cobrado ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
        )}
      >
        {numberToCurrency(monto, currency)}
      </span>
      {/* En MOBILE la columna "Propina" está oculta (`hidden sm:table-cell`), así
          que la propina viaja acá como 2ª línea verde: la tabla no gana ancho. */}
      {propina > 0.005 && (
        <span className="text-[10px] font-medium tabular-nums text-success sm:hidden">
          propina {numberToCurrency(propina, currency)}
        </span>
      )}
    </span>
  );
}

/**
 * Σ de las propinas de las jornadas de la liquidación (las **tareas** no llevan
 * propina). La propina es ingreso devengado de su jornada, pero **no** integra
 * el monto de la liquidación (que liquida sólo las horas): por eso la columna
 * "Propina" la muestra aparte del "Importe".
 */
export function propinaDeLiquidacion(p: LiquidacionOut): number {
  return (p.jornadas ?? []).reduce((acc, j) => acc + (j.montoPropina ?? 0), 0);
}

export function ActividadCell({
  jornadas,
  tareas,
  currency,
}: {
  jornadas?: LiquidacionOut["jornadas"];
  tareas?: LiquidacionOut["tareas"];
  currency: string;
}) {
  // Discriminador §8: si el período tiene JORNADAS se grafican las jornadas
  // (incl. históricos tras una conversión); si no, las TAREAS (por_tarea).
  const jornadasSorted = (jornadas || [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.fechaJornada).getTime() - new Date(b.fechaJornada).getTime()
    );
  if (jornadasSorted.length === 0) {
    const tareasSorted = (tareas || [])
      .slice()
      .sort(
        (a, b) =>
          new Date(a.fechaHoraTarea).getTime() -
          new Date(b.fechaHoraTarea).getTime()
      );
    if (tareasSorted.length === 0)
      return <span className="text-subtitle">—</span>;
    return (
      <SparkLineChart
        variant="bar"
        data={tareasSorted.map((t) => t.montoTarea || 0)}
        labels={tareasSorted.map((t) => fechaHoraLabel(t.fechaHoraTarea))}
        currency={currency}
      />
    );
  }
  return (
    <SparkLineChart
      variant="bar"
      data={jornadasSorted.map((j) => (j.montoJornada || 0) + (j.montoPropina || 0))}
      labels={jornadasSorted.map((j) => dateTimeToString(j.fechaJornada))}
      currency={currency}
    />
  );
}

export function ingresosDetalleColumns(
  currency: string
): ColumnDef<LiquidacionOut>[] {
  return [
  {
    accessorFn: (row) => row.trabajo?.nombre ?? "",
    id: "trabajo",
    header: "Trabajo",
    cell: ({ getValue }) => (getValue<string>() ? getValue<string>() : "-"),
    footer: "Total",
  },
  {
    // "Desde" y "Hasta" fusionadas en una sola columna (P1.e): en el modelo nuevo
    // el RANGO es el dato de la liquidación (en `fijo`/`horas_fijas` es declarado
    // y en las variables se deriva de los ítems). El accessor expone `fechaDesde`,
    // así el orden por defecto y el clic en el header son CRONOLÓGICOS (no por el
    // texto "dd-mm-aaaa al ...").
    id: "periodo",
    header: "Período",
    accessorFn: (row) => row.fechaDesde,
    sortingFn: (a, b) =>
      new Date(a.original.fechaDesde).getTime() -
      new Date(b.original.fechaDesde).getTime(),
    meta: { align: "center" },
    cell: ({ row }) =>
      `${dateTimeToString(row.original.fechaDesde)} al ${dateTimeToString(
        row.original.fechaHasta
      )}`,
  },
  {
    // `id` explícito (no `accessorKey: "montoACobrar"`, que ya no existe): el
    // orden sigue funcionando sobre el monto realmente cobrado.
    id: "importe",
    accessorFn: (row) => row.montoCobrado ?? row.montoCalculado ?? 0,
    header: "Importe",
    meta: { align: "right" },
    cell: ({ row }) => (
      <ImporteCell
        montoCobrado={row.original.montoCobrado}
        montoCalculado={row.original.montoCalculado}
        fechaDeCobro={row.original.fechaDeCobro}
        propina={propinaDeLiquidacion(row.original)}
        currency={currency}
      />
    ),
    footer: ({ table }) => {
      const rows = table.getFilteredRowModel().rows;
      const total = rows.reduce(
        (acc, row) =>
          acc +
          ((row.original.montoCobrado ?? row.original.montoCalculado) || 0),
        0
      );
      return numberToCurrency(total, currency);
    },
  },
  {
    // **Propina** de las jornadas de la liquidación (2026-09-27, pedido del
    // usuario). Es parte del INGRESO devengado (entra en el badge del mes y en
    // el Histórico por la fecha de su jornada) pero **no** del monto de la
    // liquidación —ese liquida sólo las horas—, así que se muestra aparte y en
    // verde, y sólo cuando existe.
    id: "propina",
    header: "Propina",
    accessorFn: (row) => propinaDeLiquidacion(row),
    // Sólo en `sm+`: en mobile la propina va como 2ª línea verde del Importe
    // (`ImporteCell`), así la tabla no gana ancho en el celular.
    meta: { align: "right", className: "hidden sm:table-cell" },
    cell: ({ row }) => {
      const propina = propinaDeLiquidacion(row.original);
      if (propina <= 0.005) return <span className="text-subtitle">—</span>;
      return (
        <span className="text-[12px] font-medium tabular-nums text-success">
          {numberToCurrency(propina, currency)}
        </span>
      );
    },
    footer: ({ table }) => {
      const total = table
        .getFilteredRowModel()
        .rows.reduce((acc, row) => acc + propinaDeLiquidacion(row.original), 0);
      return total > 0.005 ? numberToCurrency(total, currency) : "—";
    },
  },
  {
    // La liquidación se muestra con su RANGO (columna Período) **además** de la
    // fecha de cobro (P1.e). La vieja columna "Estimación Cobro" se quitó: en el
    // modelo nuevo `fechaEstimadaCobro` no se carga (P1.c).
    accessorKey: "fechaDeCobro",
    header: "Cobrado",
    meta: { align: "center" },
    cell: ({ getValue }) => formatCobroDate(getValue<string | Date>()),
  },
  {
    id: "actividad",
    header: "Jornadas/Tareas",
    // La columna del sparkline NO navega al período: el gráfico solo muestra el
    // tooltip de cada barra.
    meta: { align: "center" },
    cell: ({ row }) => (
      <ActividadCell
        jornadas={row.original.jornadas}
        tareas={row.original.tareas}
        currency={currency}
      />
    ),
  },
  ];
}

export function IngresosDetalle({
  data,
  currency,
}: {
  data: LiquidacionOut[];
  currency: string;
}) {
  return (
    <DataTable
      columns={ingresosDetalleColumns(currency)}
      data={data}
      pageSize={5}
      // Por defecto se ordena por el período más reciente (fecha desde DESC).
      initialSorting={[{ id: "periodo", desc: true }]}
    />
  );
}
