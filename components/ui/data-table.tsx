"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Align = "left" | "center" | "right";

function alignClass(align?: Align): string {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  pageSize?: number;
  /** Devuelve un id estable por fila (default: índice). Evita que React reutilice
   * filas equivocadas cuando el orden de los datos cambia (p. ej. switches). */
  getRowId?: (originalRow: TData, index: number) => string;
  /** Clases extra por fila (recibe el registro original), p. ej. resaltar la fila
   * seleccionada en modo mobile (barra inferior de acciones). */
  rowClassName?: (originalRow: TData) => string;
  /** Click en una fila (recibe el registro original). Activa cursor pointer. */
  onRowClick?: (originalRow: TData) => void;
  /** Orden inicial de la tabla, p. ej. `[{ id: "periodo", desc: true }]`. */
  initialSorting?: SortingState;
  /** Variante COMPACTA para las grillas mobile: `px-1.5` en vez de `px-3` (el
      ancho del celular es escaso: a 320px una tabla de 3 columnas con fechas y
      montos no entraba por el padding lateral) y tipografía de 12px. Solo
      cambia el estilo, no el comportamiento. */
  dense?: boolean;
}

/**
 * Tabla genérica reutilizable con sort, paginación y tema claro/oscuro.
 * Se usa en el dashboard (detalle de gastos) y en las páginas CRUD (Fase 2).
 */
export function DataTable<TData, TValue>({
  columns,
  data,
  emptyMessage = "Sin datos disponibles",
  pageSize = 10,
  getRowId,
  rowClassName,
  onRowClick,
  initialSorting,
  dense = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? []);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });
  // Padding lateral de las celdas: compacto en las grillas mobile.
  const cellPad = dense ? "px-1.5 py-2" : "px-3 py-2.5";

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const hasFooter = columns.some((c) => c.footer != null);

  if (!data.length) {
    return (
      <div className="flex h-32 items-center justify-center text-[13px] text-subtitle">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table
          className={cn(
            "w-full border-collapse",
            dense ? "text-[12px]" : "text-[13px]"
          )}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as
                    | { align?: Align }
                    | undefined;
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "whitespace-nowrap font-medium text-subtitle",
                        cellPad,
                        alignClass(meta?.align)
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "inline-flex items-center gap-1 hover:text-header",
                            sorted && "text-header"
                          )}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {sorted === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : sorted === "desc" ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                // Id de la fila en el DOM: lo usa el menú deslizante
                // (`SwipeRowActions`) para resolver a qué registro pertenece la
                // fila que se está arrastrando.
                data-row-id={row.id}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  "border-b border-border last:border-0 transition-colors hover:bg-muted/40",
                  rowClassName?.(row.original),
                  onRowClick && "cursor-pointer select-none"
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as
                    | { align?: Align }
                    | undefined;
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        "text-card-foreground",
                        cellPad,
                        alignClass(meta?.align)
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {hasFooter &&
            table.getFooterGroups().map((footerGroup) => (
              <tfoot key={footerGroup.id}>
                <tr>
                  {footerGroup.headers.map((footer) => {
                    const meta = footer.column.columnDef.meta as
                      | { align?: Align }
                      | undefined;
                    return (
                      <td
                        key={footer.id}
                        className={cn(
                          "border-t border-border bg-muted/40 font-medium text-card-foreground",
                          cellPad,
                          alignClass(meta?.align)
                        )}
                      >
                        {footer.isPlaceholder
                          ? null
                          : flexRender(
                              footer.column.columnDef.footer,
                              footer.getContext()
                            )}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            ))}
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[12px] text-subtitle">
        <span>
          Página {table.getState().pagination.pageIndex + 1} de{" "}
          {Math.max(table.getPageCount(), 1)}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Página anterior"
            className="rounded p-1 text-card-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Página siguiente"
            className="rounded p-1 text-card-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
