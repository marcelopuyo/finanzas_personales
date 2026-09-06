"use client";

import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/ui/modal";
import { DataTable } from "@/components/ui/data-table";
import type { PeriodoTrabajoOut } from "@/backend/src/queries/trabajos";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";

export type TipoPeriodos = "cobrar" | "actuales";

const TITULOS: Record<TipoPeriodos, string> = {
  cobrar: "Por cobrar",
  actuales: "Actuales",
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
  const router = useRouter();
  // Lanza el wizard de cobro de sueldo con el período de la fila preseleccionado
  // (y su monto a cobrar precargado), reutilizando el query param `periodo`.
  const cobrar = (id: number) => {
    router.push(`/movimientos/nuevo/cobro?periodo=${id}`);
    onClose();
  };

  const columnasBase: ColumnDef<PeriodoTrabajoOut>[] = [
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
      // Muestra la FECHA ESTIMADA de cobro (fechaEstimadaCobro de la BD), en
      // ambos paneles ("Por cobrar" y "Actuales").
      accessorKey: "fechaEstimadaCobro",
      header: "Fecha Est. Cobro",
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

  // Icono "Cobrar" por fila: lanza el wizard de cobro de sueldo directamente
  // con ese período preseleccionado. Solo en el listado "Por cobrar"
  // (los "Actuales" aún no están cerrados, no corresponden cobrarlos).
  const columnasCobro: ColumnDef<PeriodoTrabajoOut>[] = [
    {
      id: "cobrar",
      header: "Cobrar",
      meta: { align: "center" } as const,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <button
            type="button"
            onClick={() => cobrar(p.id)}
            title="Cobrar"
            aria-label={`Cobrar período de ${p.trabajo?.nombre ?? "trabajo"} (${dateTimeToString(p.fechaDesde)} al ${dateTimeToString(p.fechaHasta)})`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-primary transition-colors hover:bg-primary/15"
          >
            <Banknote className="h-4 w-4" />
          </button>
        );
      },
    },
  ];

  const columns: ColumnDef<PeriodoTrabajoOut>[] =
    tipo === "cobrar" ? [...columnasBase, ...columnasCobro] : columnasBase;

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
