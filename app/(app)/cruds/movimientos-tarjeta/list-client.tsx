"use client";
import { CrudTable } from "@/components/crud/CrudTable";
import type { MovimientoTarjetaOut } from "@/backend/src/queries/tarjetas";
import { eliminarMovimientoTarjeta } from "@/backend/src/actions/tarjetas";
import type { ColumnDef } from "@tanstack/react-table";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";
const columns: ColumnDef<MovimientoTarjetaOut>[] = [
  { accessorKey: "detalle", header: "Detalle", cell: ({ getValue }) => getValue<string|null>() ?? "—" },
  { accessorKey: "fecha", header: "Fecha", cell: ({ getValue }) => dateTimeToString(getValue<Date>()), meta: { align: "center" as const } },
  { accessorKey: "monto", header: "Monto", meta: { align: "right" as const, isCurrency: true }, cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0) },
  { accessorKey: "cuotas", header: "Cuotas", meta: { align: "center" as const } },
  { accessorFn: (r) => r.persona?.nombre ?? "", id: "persona", header: "Persona" },
  { accessorFn: (r) => r.tarjeta?.nombre ?? "", id: "tarjeta", header: "Tarjeta" },
  { accessorFn: (r) => r.periodo?.nombre ?? "", id: "periodo", header: "Período" },
];
interface Props { initialData: MovimientoTarjetaOut[] }
export function MovimientosTarjetaListClient({ initialData }: Props) {
  return <CrudTable<MovimientoTarjetaOut, string> title="Movimientos de Tarjeta" columns={columns} initialData={initialData} deleteItem={eliminarMovimientoTarjeta} searchPlaceholder="Buscar movimiento..." createHref="/cruds/movimientos-tarjeta/nuevo" editHref={(id) => `/cruds/movimientos-tarjeta/${id}/editar`} getId={(i) => i.id} searchPredicate={(i, q) => (i.detalle ?? "").toLowerCase().includes(q)} />;
}
