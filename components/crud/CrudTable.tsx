"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileDown, Pencil, Plus, Search, Trash2, type LucideIcon } from "lucide-react";
import { BottomActionBar } from "@/components/ui/bottom-action-bar";
import { DataTable } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { cn, numberToCurrency } from "@/lib/utils";

interface CrudTableProps<T, TId = number> {
  title: string;
  columns: ColumnDef<T>[];
  /** Datos precargados desde Server Component (patrón recomendado). */
  initialData?: T[];
  /** Función de fetch legacy (opcional si se usa initialData). */
  fetchData?: () => Promise<T[]>;
  deleteItem: (id: TId) => Promise<unknown>;
  searchPlaceholder?: string;
  /** false = oculta el buscador en la vista clásica (la grilla mobile no tiene
      buscador). Se usa en vistas de solo lectura donde buscar no aporta
      (p. ej. el detalle de un período ya cobrado). Default: true. */
  showSearch?: boolean;
  createHref: string;
  editHref: (id: TId) => string;
  getId: (item: T) => TId;
  searchPredicate: (item: T, query: string) => boolean;
  /** Si se pasa, muestra un botón "volver" (←) a la izquierda del título
      (patrón mobile app), ej. al entrar al CRUD desde el dashboard. */
  backHref?: string;
  /** ISO 4217 para formatear columnas currency en la exportación PDF (default ARS). */
  currency?: string;
  /** Modo mobile con barra inferior de acciones + FAB central (lg:hidden). En
      <lg la grilla muestra solo las columnas de datos; la fila se selecciona
      tocándola (queda resaltada) y Exportar/Editar/Eliminar/Nuevo viven en la
      barra inferior. En desktop el CRUD no cambia. */
  mobileBottomNav?: boolean;
  /** Texto opcional bajo el título en mobile (p. ej. "Tocá una fila para
      seleccionarla"). Solo aplica con mobileBottomNav. */
  mobileHint?: string;
  /** Columnas extra que se agregan AL FINAL (después de Editar/Eliminar) en
      desktop y también en la grilla mobile (bottomNav). Útiles para acciones
      por fila contextuales (p. ej. "Pagar" un préstamo). */
  trailingColumns?: ColumnDef<T>[];
  /** Acción extra opcional del CRUD: en desktop un botón en el toolbar (junto a
      Exportar/Nuevo) y en mobile una acción más en la barra inferior (al lado de
      Exportar). Útil para disparar un modo propio (p. ej. "Reordenar"). */
  extraAction?: {
    label: string;
    icon: LucideIcon;
    active?: boolean;
    onClick: () => void;
  };
  /** Acción propia adicional de la barra inferior mobile, ubicada a la
      izquierda de Exportar. Recibe el id de la fila seleccionada y queda
      deshabilitada mientras no haya ninguna. Útil para una acción de fila
      contextual (p. ej. abrir el detalle del período para cargar sus
      jornadas). */
  mobilePrimaryAction?: {
    label: string;
    icon: LucideIcon;
    onClick: (id: TId) => void;
  };
  /** Acción por fila EXTRA, **solo desktop**: un botón más en la columna de
      acciones, junto a Editar/Eliminar (ícono con el label como título/tooltip).
      En mobile el equivalente va en la barra inferior
      (`mobilePrimaryAction`), que no suma columnas a la grilla.
      Requiere `showActions` (la columna de acciones es la que la contiene). */
  rowAction?: {
    label: string;
    icon: LucideIcon;
    onClick: (id: TId) => void;
  };
  /** Contenido extra que se renderiza entre el título y la grilla (arriba del
      contenido). Útil para un resumen/header contextual (p. ej. el resumen de
      un período de trabajo con su monto a cobrar). */
  topContent?: ReactNode;
  /** false = vista de solo lectura / sin acciones: oculta la columna
      Editar/Eliminar, los botones Nuevo/Exportar (desktop), la barra inferior
      y el FAB del modo mobile. La grilla se muestra igual. */
  showActions?: boolean;
  /** Marca filas que **no son registros reales** (p. ej. la fila sintética
      "Préstamos (neto)" del CRUD de Cuentas): no se renderizan los botones de
      acción (se muestra "—") y la fila no se puede seleccionar en mobile. */
  isSyntheticRow?: (item: T) => boolean;
  /** Mensaje de la grilla cuando no hay datos (default "Sin datos disponibles"). */
  emptyMessage?: string;
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
  showSearch = true,
  createHref,
  editHref,
  getId,
  searchPredicate,
  backHref,
  currency = "ARS",
  mobileBottomNav = false,
  mobileHint,
  trailingColumns = [],
  extraAction,
  mobilePrimaryAction,
  rowAction,
  topContent,
  showActions = true,
  isSyntheticRow,
  emptyMessage = "Sin datos disponibles",
}: CrudTableProps<T, TId>) {
  const router = useRouter();
  const [items, setItems] = useState<T[]>(initialData ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<TId | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Selección por fila (solo mobile con barra inferior): una a la vez.
  const [selectedId, setSelectedId] = useState<TId | null>(null);

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
      setSelectedId(null);
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
      // Columna de acciones Editar/Eliminar: solo si la vista permite acciones
      // (showActions=false la oculta, p. ej. vistas de solo lectura).
      ...(showActions
        ? [
            {
              id: "actions",
              header: "",
              meta: { align: "center" as const },
              // Fila sintética (no es un registro real): sin acciones.
              cell: ({ row }: { row: { original: T } }) =>
                isSyntheticRow?.(row.original) ? (
                  <span className="text-subtitle">—</span>
                ) : (
                  <div className="flex items-center justify-center gap-1.5">
                    {rowAction && (
                      <button
                        type="button"
                        onClick={() => rowAction.onClick(getId(row.original))}
                        className="rounded p-1 text-subtitle transition-colors hover:bg-muted hover:text-header"
                        title={rowAction.label}
                        aria-label={rowAction.label}
                      >
                        <rowAction.icon className="h-3.5 w-3.5" />
                      </button>
                    )}
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
          ]
        : []),
      ...trailingColumns,
    ],
    [
      columns,
      router,
      editHref,
      getId,
      trailingColumns,
      showActions,
      rowAction,
      isSyntheticRow,
    ]
  );

  // Columnas de la grilla mobile (bottomNav): datos + columnas finales (sin la
  // columna de acciones Editar/Eliminar, que viven en la barra inferior).
  const mobileColumns = useMemo<ColumnDef<T>[]>(
    () => [...columns, ...trailingColumns],
    [columns, trailingColumns]
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
            if (meta?.isCurrency) return numberToCurrency(Number(raw(item)) || 0, currency);
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
          i === 0 ? "Total" : c.isCurrency ? numberToCurrency(totals[i], currency) : ""
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

  // ── Modo mobileBottomNav: piezas de la barra inferior + selección por fila ──
  // Clases de la fila seleccionada (la resaltan en la grilla mobile).
  const selectedCls = (item: T) =>
    mobileBottomNav && selectedId !== null && getId(item) === selectedId
      ? "bg-primary/10 shadow-[inset_2px_0_0_0_var(--primary)]"
      : "";
  // Toca una fila → selecciona/deselecciona (una sola a la vez). Las filas
  // sintéticas (no son registros reales) no se seleccionan.
  const toggleRow = (item: T) => {
    if (isSyntheticRow?.(item)) return;
    const id = getId(item);
    setSelectedId((prev) => (prev === id ? null : id));
  };

  // Encabezado mobile: título (+ contador de filas visibles).
  const titleMobileEl = (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {backHref && (
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="rounded-lg p-1.5 text-subtitle transition-colors hover:bg-muted hover:text-header"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <h1 className="text-[20px] font-semibold text-header">{title}</h1>
      </div>
      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-[12px] font-semibold text-subtitle">
        {filtered.length}
      </span>
    </div>
  );

  // Barra inferior fija (<lg): componente reutilizable BottomActionBar con
  // Exportar (más `mobilePrimaryAction`/`extraAction` opcionales) a la
  // izquierda, Editar/Eliminar a la derecha (se habilitan al seleccionar una
  // fila) y FAB central "+". El estado (selección de fila) se mantiene acá y se
  // pasa como props/callbacks. Solo si hay acciones.
  const bottomBarEl = mobileBottomNav && showActions ? (
    <BottomActionBar
      left={[
        ...(mobilePrimaryAction
          ? [
              {
                key: "primary",
                label: mobilePrimaryAction.label,
                icon: mobilePrimaryAction.icon,
                disabled: selectedId === null,
                onClick: () =>
                  selectedId !== null && mobilePrimaryAction.onClick(selectedId),
              },
            ]
          : []),
        { key: "export", label: "Exportar", icon: FileDown, onClick: handleExportPdf },
        ...(extraAction
          ? [
              {
                key: "extra",
                label: extraAction.label,
                icon: extraAction.icon,
                onClick: extraAction.onClick,
              },
            ]
          : []),
      ]}
      right={[
        {
          key: "edit",
          label: "Editar",
          icon: Pencil,
          disabled: selectedId === null,
          onClick: () => selectedId !== null && router.push(editHref(selectedId)),
        },
        {
          key: "delete",
          label: "Eliminar",
          icon: Trash2,
          disabled: selectedId === null,
          onClick: () => selectedId !== null && setDeleteId(selectedId),
        },
      ]}
      fabAction={{ label: "Nuevo", onClick: () => router.push(createHref) }}
    />
  ) : null;

  // Toolbar de escritorio: buscador + acciones (Extra/Exportar/Nuevo). En las
  // vistas de solo lectura sin buscador no se renderiza nada: sin esto quedaba
  // un hueco entre el contenido de arriba (p. ej. el resumen del período) y la
  // grilla.
  const toolbarEl =
    showSearch || showActions ? (
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {showSearch && (
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
        )}
        <div className="flex items-center gap-2">
          {showActions && (
            <>
              {extraAction && (
                <button
                  type="button"
                  onClick={extraAction.onClick}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors",
                    extraAction.active
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-card text-card-foreground hover:bg-muted"
                  )}
                >
                  <extraAction.icon className="h-3.5 w-3.5" />
                  {extraAction.label}
                </button>
              )}
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
            </>
          )}
        </div>
      </div>
    ) : null;

  return (
    <div
      className={cn(
        "mx-auto max-w-5xl px-4",
        mobileBottomNav && showActions
          ? "py-6 pb-44 lg:py-8 lg:pb-8"
          : "py-8"
      )}
    >
      {/* ===== Variante mobile (bottomNav): barra inferior + selección por fila ===== */}
      {mobileBottomNav && (
        <div className="lg:hidden">
          {titleMobileEl}
          {topContent}
          {mobileHint && (
            <p className="-mt-2 mb-3 text-[12px] text-subtitle">{mobileHint}</p>
          )}
          {/* En solo lectura (showActions=false) la grilla mobile no es
              interactiva: sin selección de fila ni resaltado. */}
          <div className="rounded-lg border border-border bg-card p-4">
            <DataTable
              columns={mobileColumns}
              data={filtered}
              pageSize={10}
              getRowId={(row) => String(getId(row))}
              rowClassName={showActions ? selectedCls : undefined}
              onRowClick={showActions ? toggleRow : undefined}
              emptyMessage={emptyMessage}
            />
          </div>
        </div>
      )}

      {/* ===== Vista clásica (CRUD normal, o desktop dentro de bottomNav) ===== */}
      <div className={mobileBottomNav ? "hidden lg:block" : ""}>
      {/* Encabezado: si viene con backHref (p. ej. abierto desde el dashboard
          con ?origen=dashboard) muestra el botón "volver" a la izquierda del
          título, al estilo mobile app. */}
      {backHref ? (
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="rounded-lg p-1.5 text-subtitle transition-colors hover:bg-muted hover:text-header"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-[18px] font-semibold text-header">{title}</h1>
        </div>
      ) : (
        <h1 className="mb-4 text-[18px] font-semibold text-header">{title}</h1>
      )}

      {topContent}

      {toolbarEl}

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
          <DataTable
            columns={allColumns}
            data={filtered}
            pageSize={10}
            // Row key estable por id real (evita que los switches/estado de cada
            // fila "salten" a otra cuenta si el orden de los datos cambia).
            getRowId={(row) => String(getId(row))}
            emptyMessage={emptyMessage}
          />
        )}
      </div>

      </div>

      {/* Barra inferior fija (solo mobileBottomNav) */}
      {bottomBarEl}

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
