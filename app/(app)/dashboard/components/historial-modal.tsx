"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  SwipeRowActions,
  type SwipeRowAction,
} from "@/components/crud/SwipeRowActions";
import { HistorialMovimientoRow } from "./historial-row";
import { getHistorialMovimientosCuentaAction } from "@/backend/src/actions/historial-movimientos";
import { anularMovimiento } from "@/backend/src/actions/anular-movimientos";
import type { HistorialMovimientoOut } from "@/backend/src/queries/movimientos";
import { cn, dateTimeToString, numberToCurrency } from "@/lib/utils";

export interface CuentaHistorial {
  id: number;
  nombre: string;
  /** Saldo actual ya formateado como moneda. */
  saldo: string;
  /** ISO de la moneda de la cuenta (monto y saldo del historial). */
  monedaISO: string;
  /** ISO de la moneda predeterminada del usuario (columna secundaria). */
  monedaPredeterminadaISO: string;
}

/** Filas por página de la lista mobile (mismo criterio que la tabla). */
const PAGE_SIZE = 10;

/** Popup con el historial cronológico de movimientos de una cuenta. */
export function HistorialModal({
  cuenta,
  onClose,
}: {
  cuenta: CuentaHistorial | null;
  onClose: () => void;
}) {
  const cuentaId = cuenta?.id;
  const router = useRouter();
  // Estado de la carga: `cuentaId` es la cuenta a la que corresponden `rows`.
  // Mientras no coincida con la cuenta abierta, la grilla está cargando (el
  // "loading" se DERIVA, así el efecto sólo actualiza estado cuando el fetch
  // responde — ver `react-hooks/set-state-in-effect`).
  const [datos, setDatos] = useState<{
    cuentaId: number | null;
    rows: HistorialMovimientoOut[];
    error: boolean;
  }>({ cuentaId: null, rows: [], error: false });
  const rows = datos.rows;
  const loading = !!cuentaId && datos.cuentaId !== cuentaId;
  const error = datos.error;
  /** Movimiento seleccionado para confirmar su anulación. */
  const [pendingAnular, setPendingAnular] =
    useState<HistorialMovimientoOut | null>(null);
  const [reverting, setReverting] = useState(false);

  /** Trae el historial de la cuenta abierta (el estado se toca al responder). */
  const traerHistorial = useCallback(() => {
    if (!cuentaId) return;
    getHistorialMovimientosCuentaAction(cuentaId)
      .then((data) => setDatos({ cuentaId, rows: data, error: false }))
      .catch(() => setDatos({ cuentaId, rows: [], error: true }));
  }, [cuentaId]);

  useEffect(() => {
    traerHistorial();
  }, [traerHistorial]);

  /** Recarga el historial mostrando el estado "Cargando…". */
  const load = () => {
    setDatos((prev) => ({ ...prev, cuentaId: null, error: false }));
    traerHistorial();
  };

  const handleAnular = async () => {
    if (!pendingAnular) return;
    setReverting(true);
    try {
      await anularMovimiento(pendingAnular.id);
      toast.success("Movimiento eliminado correctamente");
      setPendingAnular(null);
      // Refresca la lista del popup y las tarjetas del dashboard (saldos).
      load();
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo anular el movimiento"
      );
    } finally {
      setReverting(false);
    }
  };

  // Orden cronológico decreciente (más reciente primero)
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      ),
    [rows]
  );

  // Solo se muestra la columna "En tu moneda" cuando la moneda de la cuenta es
  // DISTINTA a la predeterminada: si coinciden, ambos montos son idénticos y no
  // tiene sentido duplicar la información.
  const mostrarMonedaPredeterminada =
    !!cuenta && cuenta.monedaISO !== cuenta.monedaPredeterminadaISO;

  // ── Paginación de la lista mobile ──
  // La página se guarda junto con la cuenta a la que pertenece: al abrir otra
  // cuenta se vuelve a la primera SIN tocar estado en un efecto (mismo criterio
  // que el `loading` derivado de arriba).
  const [pagina, setPagina] = useState<{
    cuentaId: number | null;
    index: number;
  }>({ cuentaId: null, index: 0 });
  const pageIndex = pagina.cuentaId === cuentaId ? pagina.index : 0;
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  // Al eliminar la última fila de la última página el índice puede quedar fuera
  // de rango: se recorta al vuelo, sin estado extra.
  const paginaActual = Math.min(pageIndex, pageCount - 1);
  const visibles = sorted.slice(
    paginaActual * PAGE_SIZE,
    paginaActual * PAGE_SIZE + PAGE_SIZE
  );
  const irAPagina = (index: number) =>
    setPagina({ cuentaId: cuentaId ?? null, index });

  /**
   * Acciones del swipe de una fila de la lista mobile. Solo "Eliminar", con el
   * mismo estilo que el resto de la app (círculo rojo + papelera).
   */
  const accionesFila = (rowId: string): SwipeRowAction[] | null => {
    const mov = sorted.find((m) => m.id === rowId);
    if (!mov) return null;
    return [
      {
        key: "delete",
        label: "Eliminar",
        icon: Trash2,
        tone: "danger",
        onClick: () => setPendingAnular(mov),
      },
    ];
  };

  const columnaMonedaPredeterminada: ColumnDef<HistorialMovimientoOut>[] = [
    {
      accessorKey: "montoPredeterminada",
      header: "En tu moneda",
      meta: { align: "right" } as const,
      cell: ({ getValue }) => (
        <span className="text-subtitle">
          {numberToCurrency(
            Number(getValue<number>() ?? 0),
            cuenta?.monedaPredeterminadaISO ?? "ARS"
          )}
        </span>
      ),
    },
  ];

  const columns: ColumnDef<HistorialMovimientoOut>[] = [
    {
      accessorKey: "fecha",
      header: "Fecha",
      cell: ({ getValue }) => dateTimeToString(getValue<Date | string>()),
    },
    {
      accessorKey: "motivo",
      header: "Motivo",
      cell: ({ getValue }) => (
        <span className="text-card-foreground">{String(getValue())}</span>
      ),
    },
    {
      accessorKey: "monto",
      header: "Monto",
      meta: { align: "right" } as const,
      cell: ({ row }) => {
        const monto = Number(row.original.monto);
        const esEgreso =
          (row.original.categoria ?? "").toLowerCase() === "egreso";
        const mostrar = esEgreso ? -Math.abs(monto) : Math.abs(monto);
        return (
          <span
            className={cn(
              "font-medium",
              esEgreso ? "text-danger" : "text-success"
            )}
          >
            {numberToCurrency(mostrar, cuenta?.monedaISO ?? "ARS")}
          </span>
        );
      },
    },
    ...(mostrarMonedaPredeterminada ? columnaMonedaPredeterminada : []),
    {
      accessorKey: "saldoPosterior",
      header: "Saldo",
      meta: { align: "right" } as const,
      cell: ({ getValue }) =>
        numberToCurrency(
          Number(getValue<number>() ?? 0),
          cuenta?.monedaISO ?? "ARS"
        ),
    },
    {
      id: "actions",
      header: "",
      meta: { align: "center" } as const,
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setPendingAnular(row.original)}
            disabled={reverting}
            className="rounded p-1 text-subtitle transition-colors hover:bg-muted hover:text-danger"
            aria-label="Eliminar movimiento"
            title="Eliminar movimiento"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    } as ColumnDef<HistorialMovimientoOut>,
  ];

  return (
    <>
      <Modal
        open={!!cuenta}
        onClose={() => {
          if (!pendingAnular) onClose();
        }}
        title="Movimientos"
        className="sm:max-w-xl"
      >
        <div className="space-y-3">
          {cuenta && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
              <p className="text-[13px] font-medium text-header">
                {cuenta.nombre}
              </p>
              <p className="text-[16px] font-semibold tracking-tight text-value">
                {cuenta.saldo}
              </p>
            </div>
          )}
          {loading ? (
            <div className="flex h-32 items-center justify-center text-[13px] text-subtitle">
              Cargando historial…
            </div>
          ) : error ? (
            <div className="flex h-32 items-center justify-center text-[13px] text-danger">
              No se pudo cargar el historial.
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-[13px] text-subtitle">
              Sin datos disponibles
            </div>
          ) : (
            <>
              {/* ── MOBILE (<sm): filas multilínea + swipe ──
                  La tabla de 5–6 columnas no entra en el celular y obligaba a
                  scroll horizontal (rediseño 2026-09-20). La acción va en el
                  swipe, así que las filas ya no tienen columna de botones. */}
              <div className="sm:hidden">
                <SwipeRowActions
                  // Al cambiar de página se REMONTA: cierra el menú abierto y no
                  // deja una franja suelta de la página anterior.
                  key={paginaActual}
                  actionsFor={accionesFila}
                >
                  {/* `overflow-hidden` recorta la fila cuando se corre para
                      revelar las acciones. */}
                  <div className="overflow-hidden rounded-lg border border-border bg-card">
                    <ul>
                      {visibles.map((m) => (
                        <HistorialMovimientoRow
                          key={m.id}
                          movimiento={m}
                          monedaISO={cuenta?.monedaISO ?? "ARS"}
                          monedaPredeterminadaISO={
                            cuenta?.monedaPredeterminadaISO ?? "ARS"
                          }
                          mostrarEquivalente={mostrarMonedaPredeterminada}
                        />
                      ))}
                    </ul>
                  </div>
                </SwipeRowActions>
                <TablePagination
                  pageIndex={paginaActual}
                  pageCount={pageCount}
                  onPrev={() => irAPagina(paginaActual - 1)}
                  onNext={() => irAPagina(paginaActual + 1)}
                  className="mt-2 py-2"
                />
              </div>

              {/* ── Desde sm (640px): la tabla de siempre, sin cambios ── */}
              <div className="hidden sm:block">
                <DataTable
                  columns={columns}
                  data={sorted}
                  pageSize={PAGE_SIZE}
                />
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal de confirmación */}
      <Modal
        open={pendingAnular !== null}
        onClose={() => setPendingAnular(null)}
        title="Eliminar movimiento"
        className="sm:max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingAnular(null)}
              disabled={reverting}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAnular}
              disabled={reverting}
              className="rounded-lg bg-danger px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {reverting ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        }
      >
        {pendingAnular && (
          <div className="space-y-2">
            <p className="text-[13px] text-card-foreground">
              Se eliminará el movimiento y se ajustará el saldo de la cuenta.
              Esta acción no se puede deshacer.
            </p>
            <div className="space-y-1.5 rounded-lg border border-border bg-muted p-3 text-[13px]">
              <div className="flex justify-between gap-3">
                <span className="text-subtitle">Fecha</span>
                <span className="font-medium text-card-foreground">
                  {dateTimeToString(pendingAnular.fecha)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-subtitle">Motivo</span>
                <span className="font-medium text-card-foreground">
                  {pendingAnular.motivo}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-subtitle">Monto</span>
                <span
                  className={cn(
                    "font-semibold",
                    (pendingAnular.categoria ?? "").toLowerCase() === "egreso"
                      ? "text-danger"
                      : "text-success"
                  )}
                >
                  {numberToCurrency(
                    (pendingAnular.categoria ?? "").toLowerCase() === "egreso"
                      ? -Math.abs(Number(pendingAnular.monto))
                      : Math.abs(Number(pendingAnular.monto)),
                    cuenta?.monedaISO ?? "ARS"
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
