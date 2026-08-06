"use client";
import { CrudTable } from "@/components/crud/CrudTable";
import type { PeriodoTrabajoOut } from "@/backend/src/queries/trabajos";
import { eliminarPeriodoTrabajo } from "@/backend/src/actions/trabajos";
import type { ColumnDef } from "@tanstack/react-table";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";
const columns: ColumnDef<PeriodoTrabajoOut>[] = [
  { accessorKey: "fechaDesde", header: "Desde", cell: ({ getValue }) => dateTimeToString(getValue<Date>()), meta: { align: "center" as const } },
  { accessorKey: "fechaHasta", header: "Hasta", cell: ({ getValue }) => dateTimeToString(getValue<Date>()), meta: { align: "center" as const } },
  { accessorKey: "montoACobrar", header: "A Cobrar", meta: { align: "right" as const, isCurrency: true }, cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0) },
  { accessorKey: "fechaDeCobro", header: "Cobrado", cell: ({ getValue }) => dateTimeToString(getValue<Date|null>() ?? undefined), meta: { align: "center" as const } },
  { accessorFn: (r) => r.trabajo?.nombre ?? "", id: "trabajo", header: "Trabajo" },
];
interface Props { initialData: PeriodoTrabajoOut[] }
export function PeriodosTrabajoListClient({ initialData }: Props) {
  return <CrudTable<PeriodoTrabajoOut> title="Períodos de Trabajo" columns={columns} initialData={initialData} deleteItem={eliminarPeriodoTrabajo} createHref="/cruds/periodos-trabajo/nuevo" editHref={(id) => `/cruds/periodos-trabajo/${id}/editar`} getId={(i) => i.id} searchPredicate={() => true} />;
}
