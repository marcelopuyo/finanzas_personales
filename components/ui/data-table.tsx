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
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });

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
        <table className="w-full border-collapse text-[13px]">
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
                        "whitespace-nowrap px-3 py-2.5 font-medium text-subtitle",
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
                className="border-b border-border last:border-0 transition-colors hover:bg-muted/40"
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as
                    | { align?: Align }
                    | undefined;
                  return (
                    <td
                      key={cell.id}
                      className={cn(
                        "px-3 py-2.5 text-card-foreground",
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
                          "border-t border-border bg-muted/40 px-3 py-2.5 font-medium text-card-foreground",
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
