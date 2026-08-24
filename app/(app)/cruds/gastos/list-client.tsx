"use client";

import { CrudTable } from "@/components/crud/CrudTable";
import type { GastoOut } from "@/backend/src/queries/gastos";
import { eliminarGasto } from "@/backend/src/actions/gastos";
import type { ColumnDef } from "@tanstack/react-table";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";

function gastosColumns(currency: string): ColumnDef<GastoOut>[] {
  return [
    {
      accessorKey: "fechaPago",
      header: "Fecha",
      meta: {
        align: "center" as const,
        exportValue: (row: GastoOut) =>
          dateTimeToString(row.fechaPago ?? undefined),
      },
      cell: ({ getValue }) =>
        dateTimeToString(getValue<string | Date | null>() ?? undefined),
    },
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
        exportValue: (row: GastoOut) => numberToCurrency(row.monto, currency),
      },
      cell: ({ getValue }) =>
        numberToCurrency(getValue<number>() ?? 0, currency),
    },
    {
      accessorKey: "saldo",
      header: "Saldo",
      meta: {
        align: "right" as const,
        isCurrency: true,
        exportValue: (row: GastoOut) => numberToCurrency(row.saldo, currency),
      },
      cell: ({ getValue }) =>
        numberToCurrency(getValue<number>() ?? 0, currency),
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
}

interface Props {
  initialData: GastoOut[];
  /** ISO de la moneda predeterminada del usuario (símbolo de montos/saldos). */
  currency?: string;
}

export function GastosListClient({ initialData, currency = "USD" }: Props) {
  return (
    <CrudTable<GastoOut, string>
      title="Gastos"
      columns={gastosColumns(currency)}
      initialData={initialData}
      currency={currency}
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
