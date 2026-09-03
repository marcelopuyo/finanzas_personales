"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
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
  const [rows, setRows] = useState<HistorialMovimientoOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  /** Movimiento seleccionado para confirmar su anulación. */
  const [pendingAnular, setPendingAnular] =
    useState<HistorialMovimientoOut | null>(null);
  const [reverting, setReverting] = useState(false);

  const load = useCallback(() => {
    if (!cuentaId) return;
    setLoading(true);
    setError(false);
    getHistorialMovimientosCuentaAction(cuentaId)
      .then((data) => setRows(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [cuentaId]);

  useEffect(() => {
    setRows([]);
    load();
  }, [load]);

  const handleAnular = async () => {
    if (!pendingAnular) return;
    setReverting(true);
    try {
      await anularMovimiento(pendingAnular.id);
      toast.success("Movimiento anulado correctamente");
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
            aria-label="Anular movimiento"
            title="Anular movimiento"
          >
            <Undo2 className="h-3.5 w-3.5" />
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
          ) : (
            <DataTable columns={columns} data={sorted} pageSize={10} />
          )}
        </div>
      </Modal>

      {/* Modal de confirmación de anulación */}
      <Modal
        open={pendingAnular !== null}
        onClose={() => setPendingAnular(null)}
        title="Anular movimiento"
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
              {reverting ? "Anulando..." : "Anular movimiento"}
            </button>
          </div>
        }
      >
        {pendingAnular && (
          <div className="space-y-2">
            <p className="text-[13px] text-card-foreground">
              Se revertirá el siguiente movimiento y se ajustará el saldo de la
              cuenta. Esta acción no se puede deshacer.
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
