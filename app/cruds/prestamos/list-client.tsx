"use client";
import { CrudTable } from "@/components/crud/CrudTable";
import type { PrestamoOut } from "@/backend/src/queries/prestamos";
import { eliminarPrestamo } from "@/backend/src/actions/prestamos";
import type { ColumnDef } from "@tanstack/react-table";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";
const columns: ColumnDef<PrestamoOut>[] = [
  { accessorKey: "detalle", header: "Detalle", cell: ({ getValue }) => getValue<string|null>() ?? "—" },
  { accessorKey: "fecha", header: "Fecha", cell: ({ getValue }) => dateTimeToString(getValue<Date>()), meta: { align: "center" as const } },
  { accessorKey: "monto", header: "Monto", meta: { align: "right" as const, isCurrency: true }, cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0) },
  { accessorKey: "saldo", header: "Saldo", meta: { align: "right" as const, isCurrency: true }, cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0) },
  { accessorFn: (r) => r.personaOrigen?.nombre ?? "", id: "origen", header: "Origen" },
  { accessorFn: (r) => r.personaDestino?.nombre ?? "", id: "destino", header: "Destino" },
  { accessorKey: "sentido", header: "Sentido" },
];
interface Props { initialData: PrestamoOut[] }
export function PrestamosListClient({ initialData }: Props) {
  return <CrudTable<PrestamoOut, string> title="Préstamos" columns={columns} initialData={initialData} deleteItem={eliminarPrestamo} searchPlaceholder="Buscar préstamo..." createHref="/cruds/prestamos/nuevo" editHref={(id) => `/cruds/prestamos/${id}/editar`} getId={(i) => i.id} searchPredicate={(i, q) => (i.detalle ?? "").toLowerCase().includes(q)} />;
}
