"use client";
import { CrudTable } from "@/components/crud/CrudTable";
import type { JornadaTrabajoOut } from "@/backend/src/queries/trabajos";
import { eliminarJornadaTrabajo } from "@/backend/src/actions/trabajos";
import type { ColumnDef } from "@tanstack/react-table";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";
const columns: ColumnDef<JornadaTrabajoOut>[] = [
  { accessorKey: "fechaJornada", header: "Fecha", cell: ({ getValue }) => dateTimeToString(getValue<Date>()), meta: { align: "center" as const } },
  { accessorKey: "horaDesde", header: "Desde", meta: { align: "center" as const } },
  { accessorKey: "horaHasta", header: "Hasta", meta: { align: "center" as const } },
  { accessorKey: "montoJornada", header: "Monto", meta: { align: "right" as const }, cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0) },
  { accessorKey: "montoPropina", header: "Propina", meta: { align: "right" as const }, cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0) },
];
interface Props { initialData: JornadaTrabajoOut[] }
export function JornadasTrabajoListClient({ initialData }: Props) {
  return <CrudTable<JornadaTrabajoOut, string> title="Jornadas de Trabajo" columns={columns} initialData={initialData} deleteItem={eliminarJornadaTrabajo} createHref="/cruds/jornadas-trabajo/nuevo" editHref={(id) => `/cruds/jornadas-trabajo/${id}/editar`} getId={(i) => i.id} searchPredicate={() => true} />;
}
