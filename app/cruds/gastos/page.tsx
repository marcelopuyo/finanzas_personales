"use client";

import { CrudTable } from "@/components/crud/CrudTable";
import type { ResponseGastoDto } from "@/types";
import {
  getAllGastos,
  deleteGasto,
} from "@/lib/api/endpoints/gastos.api";
import type { ColumnDef } from "@tanstack/react-table";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";

const columns: ColumnDef<ResponseGastoDto>[] = [
  {
    accessorKey: "descripcion",
    header: "Descripción",
    cell: ({ getValue }) => (getValue<string>() ? getValue<string>() : "-"),
  },
  {
    accessorKey: "monto",
    header: "Monto",
    meta: {
      align: "right",
      isCurrency: true,
      exportValue: (row: ResponseGastoDto) => numberToCurrency(row.monto),
    },
    cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0),
  },
  {
    accessorKey: "saldo",
    header: "Saldo",
    meta: {
      align: "right",
      isCurrency: true,
      exportValue: (row: ResponseGastoDto) => numberToCurrency(row.saldo),
    },
    cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0),
  },
  {
    accessorKey: "fechaVencimiento",
    header: "Vencimiento",
    meta: {
      align: "center",
      exportValue: (row: ResponseGastoDto) => dateTimeToString(row.fechaVencimiento),
    },
    cell: ({ getValue }) => dateTimeToString(getValue<string | Date>()),
  },
  {
    accessorKey: "fechaPago",
    header: "Pago",
    meta: {
      align: "center",
      exportValue: (row: ResponseGastoDto) => dateTimeToString(row.fechaPago),
    },
    cell: ({ getValue }) => dateTimeToString(getValue<string | Date>()),
  },
  {
    accessorFn: (row) => row.categoria?.nombre ?? "",
    id: "categoria",
    header: "Categoría",
  },
  {
    accessorFn: (row) => row.periodo?.nombre ?? "",
    id: "periodo",
    header: "Período",
  },
];

export default function GastosPage() {
  return (
    <CrudTable<ResponseGastoDto, string>
      title="Gastos"
      columns={columns}
      fetchData={getAllGastos}
      deleteItem={deleteGasto}
      searchPlaceholder="Buscar gasto..."
      createHref="/cruds/gastos/nuevo"
      editHref={(id) => `/cruds/gastos/${id}/editar`}
      getId={(item) => item.id}
      searchPredicate={(item, query) =>
        (item.descripcion || "").toLowerCase().includes(query) ||
        (item.categoria?.nombre || "").toLowerCase().includes(query) ||
        (item.periodo?.nombre || "").toLowerCase().includes(query)
      }
    />
  );
}
