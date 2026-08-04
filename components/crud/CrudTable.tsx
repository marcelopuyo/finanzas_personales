"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Trash2, FileDown } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { numberToCurrency } from "@/lib/utils";

interface CrudTableProps<T, TId = number> {
  title: string;
  columns: ColumnDef<T>[];
  /** Datos precargados desde Server Component (patrón recomendado). */
  initialData?: T[];
  /** Función de fetch legacy (opcional si se usa initialData). */
  fetchData?: () => Promise<T[]>;
  deleteItem: (id: TId) => Promise<unknown>;
  searchPlaceholder?: string;
  createHref: string;
  editHref: (id: TId) => string;
  getId: (item: T) => TId;
  searchPredicate: (item: T, query: string) => boolean;
}

/**
 * Tabla CRUD genérica reutilizable para todas las páginas de listado.
 * Incluye: búsqueda, botón "Nuevo", acciones por fila (editar/eliminar)
 * y modal de confirmación de eliminado. Mobile-first.
 */
export function CrudTable<T, TId = number>({
  title,
  columns,
  fetchData,
  initialData,
  deleteItem,
  searchPlaceholder = "Buscar...",
  createHref,
  editHref,
  getId,
  searchPredicate,
}: CrudTableProps<T, TId>) {
  const router = useRouter();
  const [items, setItems] = useState<T[]>(initialData ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<TId | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    if (!fetchData) return;
    setLoading(true);
    setError(null);
    fetchData()
      .then(setItems)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (initialData !== undefined) {
      setItems(initialData);
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((item) => searchPredicate(item, q));
  }, [items, search, searchPredicate]);

  const handleDelete = async () => {
    if (deleteId === null) return;
    setDeleting(true);
    try {
      await deleteItem(deleteId);
      toast.success("Item eliminado correctamente");
      setDeleteId(null);
      load();
    } catch {
      toast.error("Error al eliminar el item");
    } finally {
      setDeleting(false);
    }
  };

  const allColumns = useMemo<ColumnDef<T>[]>(
    () => [
      ...columns,
      {
        id: "actions",
        header: "",
        meta: { align: "center" as const },
        cell: ({ row }: { row: { original: T } }) => (
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => router.push(editHref(getId(row.original)))}
              className="rounded p-1 text-subtitle transition-colors hover:bg-muted hover:text-header"
              aria-label="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteId(getId(row.original))}
              className="rounded p-1 text-subtitle transition-colors hover:bg-muted hover:text-danger"
              aria-label="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      } as ColumnDef<T>,
    ],
    [columns, router, editHref, getId]
  );

  const handleExportPdf = () => {
    if (filtered.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const doc = new jsPDF();

    type ExportCol = {
      id?: string;
      header?: unknown;
      accessorKey?: string;
      accessorFn?: (row: T) => unknown;
      meta?:
        | {
            exportValue?: (item: T) => string;
            isCurrency?: boolean;
          }
        | undefined;
    };

    const exportCols = columns
      .map((c) => c as ExportCol)
      .filter((col) => col.id !== "actions")
      .map((col) => {
        const meta = col.meta as
          | { exportValue?: (item: T) => string; isCurrency?: boolean }
          | undefined;
        const raw = (item: T): unknown => {
          if (col.accessorKey) {
            return (item as Record<string, unknown>)[col.accessorKey];
          }
          if (col.accessorFn) return col.accessorFn(item);
          return undefined;
        };
        return {
          header:
            typeof col.header === "string"
              ? col.header
              : col.id || col.accessorKey || "",
          value: (item: T): string => {
            if (meta?.exportValue) return meta.exportValue(item);
            if (meta?.isCurrency) return numberToCurrency(Number(raw(item)) || 0);
            const v = raw(item);
            if (v === null || v === undefined) return "";
            if (typeof v === "object") return JSON.stringify(v);
            return String(v);
          },
          isCurrency: !!meta?.isCurrency,
          numeric: (item: T): number => Number(raw(item)) || 0,
        };
      });

    // Totales de las columnas moneda
    const totals = exportCols.map((c) =>
      c.isCurrency
        ? filtered.reduce((sum, item) => sum + c.numeric(item), 0)
        : 0
    );

    const body: string[][] = filtered.map((item) =>
      exportCols.map((c) => c.value(item))
    );
    if (exportCols.some((c) => c.isCurrency)) {
      body.push(
        exportCols.map((c, i) =>
          i === 0 ? "Total" : c.isCurrency ? numberToCurrency(totals[i]) : ""
        )
      );
    }

    doc.setFontSize(14);
    doc.text(title, 14, 16);

    autoTable(doc, {
      startY: 22,
      head: [exportCols.map((c) => c.header)],
      body,
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [76, 110, 245], textColor: 255, fontSize: 10 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didParseCell: (data) => {
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [241, 243, 246];
        }
      },
    });

    doc.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-4 text-[18px] font-semibold text-header">{title}</h1>

      {/* Toolbar: búsqueda + botón Nuevo */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtitle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-full border border-border bg-card py-1.5 pl-8 pr-3 text-[13px] text-card-foreground placeholder:text-subtitle focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-[13px] font-medium text-card-foreground transition-colors hover:bg-muted"
          >
            <FileDown className="h-3.5 w-3.5" />
            Exportar
          </button>
          <button
            type="button"
            onClick={() => router.push(createHref)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border border-border bg-card p-4">
        {loading ? (
          <div className="py-12 text-center text-[13px] text-subtitle">
            Cargando...
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-[13px] text-danger">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-2 rounded-lg bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <DataTable columns={allColumns} data={filtered} pageSize={10} />
        )}
      </div>

      {/* Modal de confirmación de eliminado */}
      <Modal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Eliminar item"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteId(null)}
              disabled={deleting}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg bg-danger px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        }
      >
        <p className="text-[14px] text-card-foreground">
          ¿Confirma la eliminación del item?
        </p>
      </Modal>
    </div>
  );
}
