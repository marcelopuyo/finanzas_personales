"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Search } from "lucide-react";
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
  search,
  onSearchChange,
  searchOpen,
}: {
  data: GastoOut[];
  total: number;
  currency?: string;
  /** Texto de búsqueda. El estado vive en DashboardClient porque el ícono que
      la abre está en la fila del título, junto al botón "Filtros". */
  search: string;
  onSearchChange: (value: string) => void;
  /** true = el input se muestra expandido (arriba de la grilla). */
  searchOpen: boolean;
}) {
  // Filtra por fecha, descripción, monto, categoría y cuenta (independiente de
  // los filtros del dashboard, que llegan ya aplicados en `data`).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((g) => {
      const texto = [
        dateTimeToString(g.fechaPago ?? undefined),
        g.descripcion ?? "",
        String(g.monto ?? ""),
        g.categoria?.nombre ?? "",
        g.cuenta ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return texto.includes(q);
    });
  }, [data, search]);

  return (
    <>
      {searchOpen && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtitle" />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar gasto..."
            aria-label="Buscar gasto"
            className="w-full rounded-full border border-border bg-card py-2 pl-9 pr-3 text-[13px] text-card-foreground placeholder:text-subtitle focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      )}
      <p className="mb-3 text-[12px] text-subtitle">
        {filtered.length} de {total} gastos
      </p>
      <DataTable
        columns={gastosDetalleColumns(currency)}
        data={filtered}
        pageSize={10}
        emptyMessage={
          search.trim()
            ? "No hay gastos que coincidan con la búsqueda"
            : "Sin datos disponibles"
        }
      />
    </>
  );
}
// ---- fin GastosDetalle (filtros movidos a DashboardClient) ----
