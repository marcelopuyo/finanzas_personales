"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import type { ResponsePeriodoTrabajoDto } from "@/types";
import { cn, dateTimeToString, numberToCurrency } from "@/lib/utils";
import { SparkLineChart } from "./sparkline-chart";

function formatCobroDate(value?: string | Date): string {
  if (!value) return "—";
  const d = new Date(value);
  if (d.getFullYear() < 1901) return "—";
  return dateTimeToString(d);
}

function ImporteCell({
  montoACobrar,
  fechaDeCobro,
}: {
  montoACobrar: number;
  fechaDeCobro?: string | Date;
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
      {numberToCurrency(montoACobrar)}
    </span>
  );
}

function JornadasCell({
  jornadas,
}: {
  jornadas?: ResponsePeriodoTrabajoDto["jornadas"];
}) {
  const sorted = (jornadas || [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.fechaJornada).getTime() - new Date(b.fechaJornada).getTime()
    );
  if (sorted.length === 0) return <span className="text-subtitle">—</span>;
  return (
    <SparkLineChart
      variant="bar"
      data={sorted.map((j) => (j.montoJornada || 0) + (j.montoPropina || 0))}
      labels={sorted.map((j) => dateTimeToString(j.fechaJornada))}
    />
  );
}

export const ingresosDetalleColumns: ColumnDef<ResponsePeriodoTrabajoDto>[] = [
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
      />
    ),
    footer: ({ table }) => {
      const rows = table.getFilteredRowModel().rows;
      const total = rows.reduce(
        (acc, row) => acc + (row.original.montoACobrar || 0),
        0
      );
      return numberToCurrency(total);
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
    id: "jornadas",
    header: "Jornadas",
    meta: { align: "center" },
    cell: ({ row }) => <JornadasCell jornadas={row.original.jornadas} />,
  },
];

export function IngresosDetalle({
  data,
}: {
  data: ResponsePeriodoTrabajoDto[];
}) {
  return (
    <DataTable columns={ingresosDetalleColumns} data={data} pageSize={5} />
  );
}
