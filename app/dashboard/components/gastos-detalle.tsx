"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { SlidersHorizontal } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { Checkbox } from "@/components/ui/checkbox";
import type { GastoOut } from "@/backend/src/queries/gastos";
import { cn, dateTimeToString, numberToCurrency } from "@/lib/utils";

export const gastosDetalleColumns: ColumnDef<GastoOut>[] = [
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
    cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0),
    footer: ({ table }) => {
      const rows = table.getFilteredRowModel().rows;
      const total = rows.reduce(
        (acc, row) => acc + (row.original.monto || 0),
        0
      );
      return numberToCurrency(total);
    },
  },
  {
    accessorFn: (row) => row.categoria?.nombre ?? "",
    id: "categoria",
    header: "Categoría",
    cell: ({ getValue }) =>
      getValue<string>() ? getValue<string>() : "Sin categoría",
  },
];

const SIN_CATEGORIA = "Sin categoría";

export function GastosDetalle({ data }: { data: GastoOut[] }) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftCategories, setDraftCategories] = useState<string[]>([]);

  // Categorías disponibles según los gastos listados actualmente
  const categories = useMemo(() => {
    const set = new Set(
      data.map((g) => g.categoria?.nombre || SIN_CATEGORIA)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredData = useMemo(() => {
    if (selectedCategories.length === 0) return data;
    return data.filter((g) =>
      selectedCategories.includes(g.categoria?.nombre || SIN_CATEGORIA)
    );
  }, [data, selectedCategories]);

  const openFilters = () => {
    setDraftCategories(selectedCategories);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setSelectedCategories(draftCategories);
    setFiltersOpen(false);
  };

  const toggleDraft = (category: string) => {
    setDraftCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  return (
    <>
      {/* Toolbar de filtros */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[12px] text-subtitle">
          {filteredData.length} de {data.length} gastos
        </p>
        <button
          type="button"
          onClick={openFilters}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
            selectedCategories.length > 0
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-muted text-card-foreground hover:bg-card"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {selectedCategories.length > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {selectedCategories.length}
            </span>
          )}
        </button>
      </div>

      <DataTable
        columns={gastosDetalleColumns}
        data={filteredData}
        pageSize={10}
      />

      {/* Modal de filtros */}
      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros"
        footer={
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setDraftCategories([]);
                setSelectedCategories([]);
                setFiltersOpen(false);
              }}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header"
            >
              Limpiar
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="rounded-lg px-3 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Aplicar
              </button>
            </div>
          </div>
        }
      >
        <p className="mb-2 text-[13px] font-medium text-header">Categoría</p>
        <div className="space-y-2.5">
          {categories.map((category) => (
            <Checkbox
              key={category}
              label={category}
              checked={draftCategories.includes(category)}
              onChange={() => toggleDraft(category)}
            />
          ))}
          {categories.length === 0 && (
            <p className="text-[13px] text-subtitle">
              Sin categorías disponibles
            </p>
          )}
        </div>
      </Modal>
    </>
  );
}
