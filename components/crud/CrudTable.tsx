"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, FileDown, Pencil, Plus, Search, Trash2, type LucideIcon } from "lucide-react";
import { BottomActionBar } from "@/components/ui/bottom-action-bar";
import { DataTable } from "@/components/ui/data-table";
import {
  SwipeRowActions,
  type SwipeRowAction,
} from "@/components/crud/SwipeRowActions";
import { Modal } from "@/components/ui/modal";
import {
  LinkNavStatus,
  startNav,
  usePendingNav,
} from "@/components/ui/nav-progress";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { cn, numberToCurrency } from "@/lib/utils";

interface CrudTableProps<T, TId = number> {
  title: string;
  columns: ColumnDef<T>[];
  /** Columnas de la grilla MOBILE (`<lg`). Si no se pasan, la grilla mobile usa
      `columns` (+ `trailingColumns`). Sirve para mostrar MENOS columnas en
      mobile (p. ej. el CRUD de períodos, cuya tabla de 6 columnas desborda el
      ancho del celular). En desktop siempre se usan `columns`. */
  mobileColumns?: ColumnDef<T>[];
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
  /** Filas por página de la grilla (mobile y desktop). Default 10. */
  rowsPerPage?: number;
  /** Filas "label: valor" que se exportan al PDF **arriba de la grilla** (debajo
      del título). Sirve para que el PDF lleve la CABECERA del contexto y no sólo
      la grilla (p. ej. los datos del período de trabajo: trabajo, rango de
      fechas, estado, horas, total a cobrar). */
  exportInfo?: { label: string; value: string }[];
  /** Modo mobile con barra inferior de acciones + FAB central (lg:hidden). En
      <lg la grilla muestra solo las columnas de datos; la fila se selecciona
      tocándola (queda resaltada) y Exportar/Editar/Eliminar/Nuevo viven en la
      barra inferior. En desktop el CRUD no cambia. */
  mobileBottomNav?: boolean;
  /** Texto opcional bajo el título en mobile (p. ej. "Tocá una fila para
      seleccionarla"). Solo aplica con mobileBottomNav. */
  mobileHint?: string;
  /** Modo "swipe" mobile (`<lg`): reemplaza las opciones de la barra inferior
      por un menú que se revela al deslizar la fila hacia la IZQUIERDA (estilo
      WhatsApp) y hace que la fila NO se seleccione al tocarla. Requiere
      `mobileBottomNav`. El FAB "Nuevo" se conserva (la barra desaparece). */
  mobileSwipe?: {
    /** Toque simple sobre una fila (el swipe NO lo dispara). */
    onRowTap?: (id: TId) => void;
    /** Acciones EXTRA por fila, que se agregan ANTES de Editar y Eliminar (esas
        dos siempre están: "Eliminar" necesita abrir el modal de confirmación
        que vive en `CrudTable`). Ej.: "Nueva jornada" en el CRUD de períodos. */
    extraActions?: (id: TId) => SwipeRowAction[];
    /** Ancho de la franja revelada, en px (default 148). Conviene subirlo cuando
        hay 3+ acciones, para que las etiquetas entren. */
    width?: number;
  };
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
      Requiere `showActions` (la columna de acciones es la que la contiene).
      Si se pasa `href`, la acción se renderiza como `<Link>` (prefetch). */
  rowAction?: {
    label: string;
    icon: LucideIcon;
    onClick: (id: TId) => void;
    href?: (id: TId) => string;
  };
  /** Destino propio de una FILA (p. ej. su detalle). No navega por sí solo:
      sirve para prefetchearlo al primer contacto (touch/mouse) en la grilla
      mobile y para el spinner de "abriendo" (2026-09-17). */
  rowHref?: (id: TId) => string;
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
  /** Clases extra por fila según el registro (p. ej. un tinte verde/rojo según
      el estado del período). Se aplican tanto a la grilla mobile como a la
      tabla desktop; en mobile el resaltado de la fila SELECCIONADA tiene
      prioridad sobre el tinte. */
  rowClassName?: (item: T) => string;
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
  mobileColumns: mobileColumnsProp,
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
  rowsPerPage = 10,
  exportInfo,
  mobileBottomNav = false,
  mobileHint,
  mobileSwipe,
  trailingColumns = [],
  extraAction,
  mobilePrimaryAction,
  rowAction,
  rowHref,
  topContent,
  showActions = true,
  isSyntheticRow,
  rowClassName,
  emptyMessage = "Sin datos disponibles",
}: CrudTableProps<T, TId>) {
  // Navegaciones con feedback (2026-09-14): `nav(href, key)` enciende la barra
  // de progreso global y marca el control tocado (FAB "Nuevo", "Editar") con un
  // spinner mientras llega la página nueva. Desde el 2026-09-17 los destinos
  // FIJOS (Editar/Nuevo) son `<Link>` y el prefetch lo hace Next solo; `nav`
  // sigue usándose para el resto (volver, barra inferior, menú deslizante).
  const { pendingKey, go: nav } = usePendingNav();
  const [items, setItems] = useState<T[]>(initialData ?? []);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<TId | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Selección por fila (solo mobile con barra inferior): una a la vez.
  const [selectedId, setSelectedId] = useState<TId | null>(null);
  // Fila cuya pantalla de detalle está abriéndose (`data-row-id`, solo mobile):
  // se atenúa y muestra un spinner (2026-09-17). No hace falta limpiarla al
  // terminar: la navegación desmonta este listado.
  const [pendingRowId, setPendingRowId] = useState<string | null>(null);

  // Re-sincroniza la lista cuando el servidor manda un `initialData` nuevo
  // (router.refresh). Se hace DURANTE el render —patrón de React "ajustar estado
  // cuando cambia una prop"— en lugar de un efecto con setState, que provocaba
  // un render en cascada.
  const [initialDataPrevia, setInitialDataPrevia] = useState(initialData);
  if (initialData !== undefined && initialData !== initialDataPrevia) {
    setInitialDataPrevia(initialData);
    setItems(initialData);
    setLoading(false);
  }

  /** Trae la lista del servidor y actualiza el estado recién cuando responde
      (nunca de forma sincrónica: ver la regla react-hooks/set-state-in-effect). */
  const fetchItems = () => {
    if (!fetchData) return;
    fetchData()
      .then(setItems)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  /** Refresco manual (p. ej. después de eliminar): muestra el spinner mientras
      recarga la lista. */
  const load = () => {
    setLoading(true);
    setError(null);
    fetchItems();
  };

  useEffect(() => {
    // Sin `initialData` la lista se trae por fetch al montar. En ese arranque
    // `loading` ya es true y `error` null, así que el fetch no toca el estado
    // antes de responder. La sincronización de la prop se hace arriba, durante
    // el render.
    if (initialData === undefined) fetchItems();
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
                    {rowAction &&
                      (rowAction.href ? (
                        <Link
                          href={rowAction.href(getId(row.original))}
                          className="rounded p-1 text-subtitle transition-colors hover:bg-muted hover:text-header"
                          title={rowAction.label}
                          aria-label={rowAction.label}
                        >
                          <rowAction.icon className="h-3.5 w-3.5" />
                          <LinkNavStatus />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => rowAction.onClick(getId(row.original))}
                          className="rounded p-1 text-subtitle transition-colors hover:bg-muted hover:text-header"
                          title={rowAction.label}
                          aria-label={rowAction.label}
                        >
                          <rowAction.icon className="h-3.5 w-3.5" />
                        </button>
                      ))}
                    {/* Editar: `<Link>` (2026-09-17) para que Next prefetchee el
                        formulario cuando la fila entra en pantalla y la
                        navegación sea casi instantánea. */}
                    <Link
                      href={editHref(getId(row.original))}
                      className="rounded p-1 text-subtitle transition-colors hover:bg-muted hover:text-header"
                      title="Editar"
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <LinkNavStatus />
                    </Link>
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
      editHref,
      getId,
      trailingColumns,
      showActions,
      rowAction,
      isSyntheticRow,
    ]
  );

  // Columnas de la grilla mobile (bottomNav): datos + columnas finales (sin la
  // columna de acciones Editar/Eliminar, que viven en el menú de la barra
  // inferior o en el swipe). Si la vista pasa `mobileColumns`, se usan esas
  // (permite un set REDUCIDO de columnas en mobile).
  const mobileColumns = useMemo<ColumnDef<T>[]>(
    () => [...(mobileColumnsProp ?? columns), ...trailingColumns],
    [mobileColumnsProp, columns, trailingColumns]
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

    // Cabecera del contexto (opcional): "label: valor" en 2 columnas, arriba de
    // la grilla. Se compone con el MISMO autoTable, sin encabezado ni bordes.
    let startY = 22;
    if (exportInfo && exportInfo.length > 0) {
      autoTable(doc, {
        startY,
        body: exportInfo.map((f) => [f.label, f.value]),
        theme: "plain",
        styles: { fontSize: 9, cellPadding: 0.7 },
        columnStyles: {
          0: { textColor: [110, 117, 130], cellWidth: 42 },
          1: { fontStyle: "bold", textColor: [33, 37, 41] },
        },
        margin: { left: 14, right: 14 },
      });
      const ultimo = (
        doc as unknown as { lastAutoTable?: { finalY?: number } }
      ).lastAutoTable;
      startY = (ultimo?.finalY ?? startY) + 5;
    }

    autoTable(doc, {
      startY,
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
            onClick={() => nav(backHref, "back")}
            aria-busy={pendingKey === "back" || undefined}
            className="rounded-lg p-1.5 text-subtitle transition-colors hover:bg-muted hover:text-header"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <h1 className="text-[20px] font-semibold text-header">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-[12px] font-semibold text-subtitle">
          {filtered.length}
        </span>
      </div>
    </div>
  );

  // ── Modo "swipe" (mobile): acciones por fila + sin selección ──
  // `data-row-id` (que agrega DataTable a cada <tr>) es el puente entre la fila
  // del DOM y el registro: acá se resuelven las acciones de esa fila.
  const swipeMode = mobileBottomNav && !!mobileSwipe;
  const swipeActionsFor = (rowId: string): SwipeRowAction[] | null => {
    if (!mobileSwipe) return null;
    const item = filtered.find((i) => String(getId(i)) === rowId);
    if (!item || isSyntheticRow?.(item)) return null;
    const id = getId(item);
    return [
      // Acciones propias de la vista, primero.
      ...(mobileSwipe.extraActions?.(id) ?? []),
      {
        key: "edit",
        label: "Editar",
        icon: Pencil,
        onClick: () => nav(editHref(id), "edit"),
      },
      {
        key: "delete",
        label: "Eliminar",
        icon: Trash2,
        onClick: () => setDeleteId(id),
      },
    ];
  };
  const swipeRowTap = (rowId: string) => {
    const item = filtered.find((i) => String(getId(i)) === rowId);
    if (!item) return;
    // Feedback de "abriendo el detalle" (2026-09-17): la fila queda atenuada con
    // un spinner y se enciende la barra global. La navegación la hace la vista
    // (`onRowTap`), que es quien conoce el destino.
    setPendingRowId(rowId);
    startNav();
    mobileSwipe?.onRowTap?.(getId(item));
  };

  // Barra inferior fija (<lg): componente reutilizable BottomActionBar con
  // Exportar (más `mobilePrimaryAction`/`extraAction` opcionales) a la
  // izquierda, Editar/Eliminar a la derecha (se habilitan al seleccionar una
  // fila) y FAB central "+". El estado (selección de fila) se mantiene acá y se
  // pasa como props/callbacks. Solo si hay acciones.
  const bottomBarEl = mobileBottomNav && showActions ? (
    // Modo swipe: las acciones viven en el menú deslizante de cada fila, así que
    // la barra queda SOLO con el FAB "Nuevo" (BottomActionBar sin acciones
    // oculta la píldora y deja el FAB solo).
    swipeMode ? (
      <BottomActionBar
        fabAction={{
          label: "Nuevo",
          href: createHref,
          pending: pendingKey === "fab",
        }}
      />
    ) : (
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
          pending: pendingKey === "edit",
          onClick: () =>
            selectedId !== null && nav(editHref(selectedId), "edit"),
        },
        {
          key: "delete",
          label: "Eliminar",
          icon: Trash2,
          disabled: selectedId === null,
          onClick: () => selectedId !== null && setDeleteId(selectedId),
        },
      ]}
      fabAction={{
        label: "Nuevo",
        href: createHref,
        pending: pendingKey === "fab",
      }}
    />
    )
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
              {/* Nuevo: `<Link>` (2026-09-17) ⇒ Next prefetchea el formulario
                  cuando el botón entra en pantalla (y el botón está en todas
                  las vistas de listado, así que la navegación ya viene lista). */}
              <Link
                href={createHref}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Plus className="h-3.5 w-3.5" />
                Nuevo
                <LinkNavStatus />
              </Link>
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
          ? // En modo swipe no hay barra inferior: alcanza con despejar el FAB.
            swipeMode
            ? "py-6 pb-28 lg:py-8 lg:pb-8"
            : "py-6 pb-44 lg:py-8 lg:pb-8"
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
          <SwipeRowActions
            actionsFor={swipeMode ? swipeActionsFor : undefined}
            onRowTap={swipeMode ? swipeRowTap : undefined}
            width={mobileSwipe?.width}
          >
            <div className="rounded-lg border border-border bg-card p-3">
              <DataTable
                columns={mobileColumns}
                data={filtered}
                pageSize={rowsPerPage}
                dense
                getRowId={(row) => String(getId(row))}
                // El tinte por estado va primero: así el resaltado de la fila
                // seleccionada (bg-primary) gana cuando hay una selección.
                rowClassName={(row) =>
                  cn(rowClassName?.(row), showActions ? selectedCls(row) : "")
                }
                // Destino propio de la fila (su detalle): se prefetchea al
                // primer contacto con el dedo (2026-09-17).
                rowHref={
                  swipeMode && rowHref
                    ? (row) => rowHref(getId(row))
                    : undefined
                }
                // Spinner/atenuado de la fila que está abriendo su detalle.
                pendingRowId={swipeMode ? pendingRowId : null}
                // En modo swipe la fila no se selecciona: el toque lo maneja
                // SwipeRowActions (`onRowTap`).
                onRowClick={
                  swipeMode ? undefined : showActions ? toggleRow : undefined
                }
                emptyMessage={emptyMessage}
              />
            </div>
          </SwipeRowActions>
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
            onClick={() => nav(backHref, "back")}
            aria-busy={pendingKey === "back" || undefined}
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
            pageSize={rowsPerPage}
            // Row key estable por id real (evita que los switches/estado de cada
            // fila "salten" a otra cuenta si el orden de los datos cambia).
            getRowId={(row) => String(getId(row))}
            rowClassName={rowClassName}
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
