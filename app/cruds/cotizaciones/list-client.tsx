"use client";
import { CrudTable } from "@/components/crud/CrudTable";
import type { CotizacionOut } from "@/backend/src/queries/maestros";
import { eliminarCotizacion } from "@/backend/src/actions/maestros";
import type { ColumnDef } from "@tanstack/react-table";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";
const columns: ColumnDef<CotizacionOut>[] = [
  { accessorKey: "fechaInicial", header: "Desde", cell: ({ getValue }) => dateTimeToString(getValue<Date>()), meta: { align: "center" as const } },
  { accessorKey: "fechaFinal", header: "Hasta", cell: ({ getValue }) => dateTimeToString(getValue<Date>()), meta: { align: "center" as const } },
  { accessorKey: "cotizacion", header: "Cotización", meta: { align: "right" as const, isCurrency: true }, cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0) },
  { accessorFn: (r) => r.moneda?.nombre ?? "", id: "moneda", header: "Moneda" },
];
interface Props { initialData: CotizacionOut[] }
export function CotizacionesListClient({ initialData }: Props) {
  return <CrudTable<CotizacionOut> title="Cotizaciones" columns={columns} initialData={initialData} deleteItem={eliminarCotizacion} createHref="/cruds/cotizaciones/nuevo" editHref={(id) => `/cruds/cotizaciones/${id}/editar`} getId={(i) => i.id} searchPredicate={() => true} />;
}
