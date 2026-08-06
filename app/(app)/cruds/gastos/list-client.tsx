"use client";

import { CrudTable } from "@/components/crud/CrudTable";
import type { GastoOut } from "@/backend/src/queries/gastos";
import { eliminarGasto } from "@/backend/src/actions/gastos";
import type { ColumnDef } from "@tanstack/react-table";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";

const columns: ColumnDef<GastoOut>[] = [
  {
    accessorKey: "descripcion",
    header: "Descripción",
    cell: ({ getValue }) => (getValue<string | null>() ?? "-"),
  },
  {
    accessorKey: "monto",
    header: "Monto",
    meta: {
      align: "right" as const,
      isCurrency: true,
      exportValue: (row: GastoOut) => numberToCurrency(row.monto),
    },
    cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0),
  },
  {
    accessorKey: "saldo",
    header: "Saldo",
    meta: {
      align: "right" as const,
      isCurrency: true,
      exportValue: (row: GastoOut) => numberToCurrency(row.saldo),
    },
    cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0),
  },
  {
    accessorKey: "fechaVencimiento",
    header: "Vencimiento",
    meta: {
      align: "center" as const,
      exportValue: (row: GastoOut) => dateTimeToString(row.fechaVencimiento ?? undefined),
    },
    cell: ({ getValue }) => dateTimeToString(getValue<string | Date | null>() ?? undefined),
  },
  {
    accessorKey: "fechaPago",
    header: "Pago",
    meta: {
      align: "center" as const,
      exportValue: (row: GastoOut) => dateTimeToString(row.fechaPago ?? undefined),
    },
    cell: ({ getValue }) => dateTimeToString(getValue<string | Date | null>() ?? undefined),
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

interface Props {
  initialData: GastoOut[];
}

export function GastosListClient({ initialData }: Props) {
  return (
    <CrudTable<GastoOut, string>
      title="Gastos"
      columns={columns}
      initialData={initialData}
      deleteItem={eliminarGasto}
      searchPlaceholder="Buscar gasto..."
      createHref="/cruds/gastos/nuevo"
      editHref={(id) => `/cruds/gastos/${id}/editar`}
      getId={(item) => item.id}
      searchPredicate={(item, query) =>
        (item.descripcion ?? "").toLowerCase().includes(query) ||
        (item.categoria?.nombre ?? "").toLowerCase().includes(query) ||
        (item.periodo?.nombre ?? "").toLowerCase().includes(query)
      }
    />
  );
}
