"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import { getHistorialMovimientosCuentaAction } from "@/backend/src/actions/historial-movimientos";
import type { HistorialMovimientoOut } from "@/backend/src/queries/movimientos";
import { cn, dateTimeToString, numberToCurrency } from "@/lib/utils";

export interface CuentaHistorial {
  id: number;
  nombre: string;
  /** Saldo actual ya formateado como moneda. */
  saldo: string;
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
  const [rows, setRows] = useState<HistorialMovimientoOut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!cuentaId) return;
    let active = true;
    setLoading(true);
    setError(false);
    setRows([]);
    getHistorialMovimientosCuentaAction(cuentaId)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cuentaId]);

  // Orden cronológico decreciente (más reciente primero)
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      ),
    [rows]
  );

  const columns: ColumnDef<HistorialMovimientoOut>[] = [
    {
      accessorKey: "fecha",
      header: "Fecha",
      cell: ({ getValue }) => dateTimeToString(getValue<Date | string>()),
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
            {numberToCurrency(mostrar)}
          </span>
        );
      },
    },
    {
      accessorKey: "motivo",
      header: "Motivo",
      cell: ({ getValue }) => (
        <span className="text-card-foreground">{String(getValue())}</span>
      ),
    },
    {
      accessorKey: "saldoPosterior",
      header: "Saldo",
      meta: { align: "right" } as const,
      cell: ({ getValue }) =>
        numberToCurrency(Number(getValue<number>() ?? 0)),
    },
  ];

  return (
    <Modal
      open={!!cuenta}
      onClose={onClose}
      title="Historial de Cuenta"
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
  );
}
