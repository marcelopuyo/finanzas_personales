"use client";
import { CrudTable } from "@/components/crud/CrudTable";
import type { PeriodoTarjetaOut } from "@/backend/src/queries/tarjetas";
import { eliminarPeriodoTarjeta } from "@/backend/src/actions/tarjetas";
import type { ColumnDef } from "@tanstack/react-table";
import { dateTimeToString } from "@/lib/utils";
const columns: ColumnDef<PeriodoTarjetaOut>[] = [
  { accessorKey: "nombre", header: "Nombre" },
  { accessorKey: "fechaApertura", header: "Apertura", cell: ({ getValue }) => dateTimeToString(getValue<Date>()), meta: { align: "center" as const } },
  { accessorKey: "fechaCierre", header: "Cierre", cell: ({ getValue }) => dateTimeToString(getValue<Date>()), meta: { align: "center" as const } },
  { accessorKey: "fechaVencimiento", header: "Vencimiento", cell: ({ getValue }) => dateTimeToString(getValue<Date>()), meta: { align: "center" as const } },
  { accessorFn: (r) => r.tarjeta?.nombre ?? "", id: "tarjeta", header: "Tarjeta" },
];
interface Props { initialData: PeriodoTarjetaOut[] }
export function PeriodosTarjetaListClient({ initialData }: Props) {
  return <CrudTable<PeriodoTarjetaOut> title="Períodos de Tarjeta" columns={columns} initialData={initialData} deleteItem={eliminarPeriodoTarjeta} searchPlaceholder="Buscar período..." createHref="/cruds/periodos-tarjeta/nuevo" editHref={(id) => `/cruds/periodos-tarjeta/${id}/editar`} getId={(i) => i.id} searchPredicate={(i, q) => i.nombre.toLowerCase().includes(q)} />;
}
