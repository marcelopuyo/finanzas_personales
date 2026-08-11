"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import type { PeriodoTrabajoOut } from "@/backend/src/queries/trabajos";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";

export type TipoPeriodos = "cobrar" | "actuales";

const TITULOS: Record<TipoPeriodos, string> = {
  cobrar: "Períodos a Cobrar",
  actuales: "Períodos Actuales",
};

/**
 * Popup de las tarjetas sintéticas de períodos:
 * - "cobrar": períodos cerrados (fecha final < hoy) aún no cobrados.
 * - "actuales": períodos con fecha final >= hoy.
 * El "Monto a Cobrar" es `montoACobrar` (que ya NO incluye propinas) y se
 * muestra en la moneda predeterminada del usuario.
 */
export function PeriodosModal({
  tipo,
  data,
  currency,
  onClose,
}: {
  tipo: TipoPeriodos | null;
  data: PeriodoTrabajoOut[];
  currency: string;
  onClose: () => void;
}) {
  const columns: ColumnDef<PeriodoTrabajoOut>[] = [
    {
      accessorKey: "trabajo",
      header: "Trabajo",
      cell: ({ row }) => (
        <span className="text-card-foreground">
          {row.original.trabajo?.nombre ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "fechaDesde",
      header: "Fecha Inicial",
      meta: { align: "center" } as const,
      cell: ({ getValue }) => dateTimeToString(getValue<Date | string>()),
    },
    {
      accessorKey: "fechaHasta",
      header: "Fecha Final",
      meta: { align: "center" } as const,
      cell: ({ getValue }) => dateTimeToString(getValue<Date | string>()),
    },
    {
      accessorKey: "fechaDeCobro",
      header: "Fecha de Cobro",
      meta: { align: "center" } as const,
      cell: ({ getValue }) => {
        const v = getValue<Date | string | null>();
        if (!v) return <span className="text-subtitle">—</span>;
        return dateTimeToString(v);
      },
    },
    {
      accessorKey: "montoACobrar",
      header: "Monto a Cobrar",
      meta: { align: "right" } as const,
      cell: ({ getValue }) => (
        <span className="font-medium text-card-foreground">
          {numberToCurrency(Number(getValue<number>() ?? 0), currency)}
        </span>
      ),
    },
  ];

  const total = data.reduce((acc, p) => acc + (p.montoACobrar || 0), 0);

  return (
    <Modal
      open={tipo !== null}
      onClose={onClose}
      title={tipo ? TITULOS[tipo] : ""}
      className="sm:max-w-2xl"
    >
      <div className="space-y-3">
        {/* Recuadro oscuro con el total, igual que el popup de historial de cuenta */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
          <p className="text-[13px] font-medium text-header">Total</p>
          <p className="text-[16px] font-semibold tracking-tight text-value">
            {numberToCurrency(total, currency)}
          </p>
        </div>
        {data.length ? (
          <DataTable columns={columns} data={data} pageSize={8} />
        ) : (
          <div className="flex h-24 items-center justify-center text-[13px] text-subtitle">
            No hay períodos para mostrar.
          </div>
        )}
      </div>
    </Modal>
  );
}
