"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import type { PeriodoTrabajoOut } from "@/backend/src/queries/trabajos";
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

function ImporteCell({
  montoACobrar,
  fechaDeCobro,
  currency,
}: {
  montoACobrar: number | null;
  fechaDeCobro?: string | Date | null;
  currency: string;
}) {
  const cobrado =
    !!fechaDeCobro && new Date(fechaDeCobro).getFullYear() >= 1901;
  return (
    <span
      className={cn(
        "inline-flex min-w-22 items-center justify-end rounded-full px-2 py-0.5 text-[12px] font-medium",
        cobrado ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      )}
    >
      {numberToCurrency(montoACobrar ?? 0, currency)}
    </span>
  );
}

export function ActividadCell({
  jornadas,
  tareas,
  currency,
}: {
  jornadas?: PeriodoTrabajoOut["jornadas"];
  tareas?: PeriodoTrabajoOut["tareas"];
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
): ColumnDef<PeriodoTrabajoOut>[] {
  return [
  {
    accessorKey: "fechaDesde",
    header: "Desde",
    meta: { align: "center" },
    cell: ({ getValue }) => dateTimeToString(getValue<string | Date>()),
  },
  {
    accessorKey: "fechaHasta",
    header: "Hasta",
    meta: { align: "center" },
    cell: ({ getValue }) => dateTimeToString(getValue<string | Date>()),
  },
  {
    accessorFn: (row) => row.trabajo?.nombre ?? "",
    id: "trabajo",
    header: "Trabajo",
    cell: ({ getValue }) => (getValue<string>() ? getValue<string>() : "-"),
    footer: "Total",
  },
  {
    accessorKey: "montoACobrar",
    header: "Importe",
    meta: { align: "right" },
    cell: ({ row }) => (
      <ImporteCell
        montoACobrar={row.original.montoACobrar}
        fechaDeCobro={row.original.fechaDeCobro}
        currency={currency}
      />
    ),
    footer: ({ table }) => {
      const rows = table.getFilteredRowModel().rows;
      const total = rows.reduce(
        (acc, row) => acc + (row.original.montoACobrar || 0),
        0
      );
      return numberToCurrency(total, currency);
    },
  },
  {
    accessorKey: "fechaEstimadaCobro",
    header: "Estimación Cobro",
    meta: { align: "center" },
    cell: ({ getValue }) => formatCobroDate(getValue<string | Date>()),
  },
  {
    accessorKey: "fechaDeCobro",
    header: "Fecha Cobro",
    meta: { align: "center" },
    cell: ({ getValue }) => formatCobroDate(getValue<string | Date>()),
  },
  {
    id: "actividad",
    header: "Jornadas/Tareas",
    // La columna del sparkline NO navega al período: el gráfico solo muestra el
    // tooltip de cada barra. `stopRowClick` corta el click/tap de esta celda
    // para que no dispare el onRowClick de la fila.
    meta: { align: "center", stopRowClick: true },
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
  onOpenPeriodo,
}: {
  data: PeriodoTrabajoOut[];
  currency: string;
  /**
   * Abre la pantalla del período al tocar/hacer click en cualquier columna de
   * la fila, EXCEPTO la del sparkline (Jornadas/Tareas), que solo muestra el
   * tooltip de sus barras.
   */
  onOpenPeriodo?: (periodo: PeriodoTrabajoOut) => void;
}) {
  return (
    <DataTable
      columns={ingresosDetalleColumns(currency)}
      data={data}
      pageSize={5}
      onRowClick={onOpenPeriodo}
    />
  );
}
