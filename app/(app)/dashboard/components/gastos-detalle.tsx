"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import type { GastoOut } from "@/backend/src/queries/gastos";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";

export function gastosDetalleColumns(currency = "ARS"): ColumnDef<GastoOut>[] {
  return [
  {
    accessorKey: "fechaPago",
    header: "Pago",
    meta: { align: "center" },
    cell: ({ getValue }) => dateTimeToString(getValue<string | Date>()),
  },
  {
    accessorFn: (row) => row.periodo?.nombre ?? "",
    id: "periodo",
    header: "Período",
    cell: ({ getValue }) => (getValue<string>() ? getValue<string>() : "-"),
  },
  {
    accessorKey: "descripcion",
    header: "Descripción",
    cell: ({ getValue }) => (getValue<string>() ? getValue<string>() : "-"),
    footer: "Total",
  },
  {
    accessorKey: "monto",
    header: "Importe",
    meta: { align: "right" },
    cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0, currency),
    footer: ({ table }) => {
      const rows = table.getFilteredRowModel().rows;
      const total = rows.reduce(
        (acc, row) => acc + (row.original.monto || 0),
        0
      );
      return numberToCurrency(total, currency);
    },
  },
  {
    accessorFn: (row) => row.categoria?.nombre ?? "",
    id: "categoria",
    header: "Categoría",
    cell: ({ getValue }) =>
      getValue<string>() ? getValue<string>() : "Sin categoría",
  },
  {
    accessorKey: "cuenta",
    header: "Cuenta",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      return v ? v : "—";
    },
  },
  ];
}

export function GastosDetalle({
  data,
  total,
  currency = "ARS",
}: {
  data: GastoOut[];
  total: number;
  currency?: string;
}) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[12px] text-subtitle">
          {data.length} de {total} gastos
        </p>
      </div>
      <DataTable columns={gastosDetalleColumns(currency)} data={data} pageSize={10} />
    </>
  );
}
// ---- fin GastosDetalle (filtros movidos a DashboardClient) ----
