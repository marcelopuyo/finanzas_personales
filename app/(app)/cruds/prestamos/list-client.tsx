"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { HandCoins } from "lucide-react";
import { CrudTable } from "@/components/crud/CrudTable";
import type { PrestamoOut } from "@/backend/src/queries/prestamos";
import { eliminarPrestamo } from "@/backend/src/actions/prestamos";
import type { ColumnDef } from "@tanstack/react-table";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";
const columns: ColumnDef<PrestamoOut>[] = [
  { accessorKey: "detalle", header: "Detalle", cell: ({ getValue }) => getValue<string|null>() ?? "—" },
  { accessorKey: "fecha", header: "Fecha", cell: ({ getValue }) => dateTimeToString(getValue<Date>()), meta: { align: "center" as const } },
  { accessorKey: "monto", header: "Monto", meta: { align: "right" as const, isCurrency: true, exportValue: (row: PrestamoOut) => numberToCurrency(row.monto, row.monedaISO ?? "ARS") }, cell: ({ getValue, row }) => numberToCurrency(getValue<number>() ?? 0, row.original.monedaISO ?? "ARS") },
  { accessorKey: "saldo", header: "Saldo", meta: { align: "right" as const, isCurrency: true, exportValue: (row: PrestamoOut) => numberToCurrency(row.saldo, row.monedaISO ?? "ARS") }, cell: ({ getValue, row }) => numberToCurrency(getValue<number>() ?? 0, row.original.monedaISO ?? "ARS") },
  { accessorFn: (r) => r.personaOrigen?.nombre ?? "", id: "origen", header: "Origen" },
  { accessorFn: (r) => r.personaDestino?.nombre ?? "", id: "destino", header: "Destino" },
  { accessorKey: "sentido", header: "Sentido" },
];
interface Props {
  initialData: PrestamoOut[];
  /** Origen de navegación (?origen=...). Si es "dashboard" se muestra el botón
      volver al dashboard y el "+"/editar conservan el origen (patrón mobile app). */
  origen?: string;
}
export function PrestamosListClient({ initialData, origen }: Props) {
  const router = useRouter();
  const desdeDashboard = origen === "dashboard";
  const origenQ = desdeDashboard ? "?origen=dashboard" : "";
  // Botón "Pagar" por fila (última columna de la grilla): solo si el préstamo
  // está impago total o parcialmente (saldo > 0). Lanza el wizard de pago con
  // ese préstamo preseleccionado (mismo estilo que "Cobrar" en los períodos de
  // trabajo cerrados del dashboard).
  const pagarColumn = useMemo<ColumnDef<PrestamoOut>[]>(
    () => [
      {
        id: "pagar",
        header: "Pagar",
        meta: { align: "center" as const },
        cell: ({ row }) => {
          const p = row.original;
          if ((p.saldo ?? 0) <= 0) {
            return <span className="text-subtitle">—</span>;
          }
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/movimientos/nuevo/pago-prestamo?prestamo=${p.id}`);
              }}
              title="Pagar préstamo"
              aria-label={`Pagar préstamo ${p.detalle ?? ""}`.trim()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-primary transition-colors hover:bg-primary/15"
            >
              <HandCoins className="h-4 w-4" />
            </button>
          );
        },
      } as ColumnDef<PrestamoOut>,
    ],
    [router]
  );
  return (
    <CrudTable<PrestamoOut, string>
      title="Préstamos"
      columns={columns}
      trailingColumns={pagarColumn}
      initialData={initialData}
      deleteItem={eliminarPrestamo}
      searchPlaceholder="Buscar préstamo..."
      createHref={`/cruds/prestamos/nuevo${origenQ}`}
      editHref={(id) => `/cruds/prestamos/${id}/editar${origenQ}`}
      getId={(i) => i.id}
      searchPredicate={(i, q) => (i.detalle ?? "").toLowerCase().includes(q)}
      backHref={desdeDashboard ? "/dashboard" : undefined}
      mobileBottomNav
    />
  );
}
