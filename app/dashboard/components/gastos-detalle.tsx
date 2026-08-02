"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import type { GastoPeriodo } from "@/types";
import { cn, dateTimeToString, numberToCurrency } from "@/lib/utils";

type SaldoStatus = "pagado" | "vencido" | "proximo" | "pendiente";

function getSaldoStatus(
  saldo: number,
  fechaVencimiento?: string | Date
): SaldoStatus {
  if (saldo === 0) return "pagado";
  if (!fechaVencimiento) return "pendiente";

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fechaVencimiento);
  venc.setHours(0, 0, 0, 0);

  if (venc <= hoy) return "vencido";
  const dias = Math.ceil(
    (venc.getTime() - hoy.getTime()) / (1000 * 3600 * 24)
  );
  return dias <= 3 ? "proximo" : "pendiente";
}

const statusClasses: Record<SaldoStatus, string> = {
  pagado: "bg-success/10 text-success",
  vencido: "bg-danger/10 text-danger",
  proximo: "bg-warning/10 text-warning",
  pendiente: "bg-muted text-muted-foreground",
};

function SaldoCell({
  saldo,
  fechaVencimiento,
}: {
  saldo: number;
  fechaVencimiento?: string | Date;
}) {
  const status = getSaldoStatus(saldo, fechaVencimiento);
  return (
    <span
      className={cn(
        "inline-flex min-w-22 items-center justify-end rounded-full px-2 py-0.5 text-[12px] font-medium",
        statusClasses[status]
      )}
    >
      {numberToCurrency(saldo)}
    </span>
  );
}

export const gastosDetalleColumns: ColumnDef<GastoPeriodo>[] = [
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
  },
  {
    accessorKey: "monto",
    header: "Importe",
    meta: { align: "right" },
    cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0),
  },
  {
    accessorKey: "saldo",
    header: "Saldo",
    meta: { align: "right" },
    cell: ({ row }) => (
      <SaldoCell
        saldo={row.original.saldo}
        fechaVencimiento={row.original.fechaVencimiento}
      />
    ),
  },
  {
    accessorFn: (row) => row.categoria?.nombre ?? "",
    id: "categoria",
    header: "Categoría",
    cell: ({ getValue }) =>
      getValue<string>() ? getValue<string>() : "Sin categoría",
  },
];

export function GastosDetalle({ data }: { data: GastoPeriodo[] }) {
  return (
    <DataTable columns={gastosDetalleColumns} data={data} pageSize={10} />
  );
}
