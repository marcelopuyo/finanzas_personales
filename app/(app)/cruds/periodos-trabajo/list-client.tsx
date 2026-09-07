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
interface Props {
  initialData: PeriodoTrabajoOut[];
  /** Origen de navegación (?origen=...). Si es "dashboard" se propaga al
      "+" (wizard de nuevo período) y al editar. La flecha volver al dashboard
      es SIEMPRE visible. */
  origen?: string;
}
export function PeriodosTrabajoListClient({ initialData, origen }: Props) {
  // Flecha "volver al dashboard" SIEMPRE visible. Al venir del panel Trabajo
  // (?origen=dashboard) se propaga el origen para que el "+" (wizard) mantenga
  // el viaje de ida y vuelta al dashboard.
  const desdeDashboard = origen === "dashboard";
  const origenQ = desdeDashboard ? "?origen=dashboard" : "";
  return <CrudTable<PeriodoTrabajoOut> title="Períodos de Trabajo" columns={columns} initialData={initialData} deleteItem={eliminarPeriodoTrabajo} createHref={`/cruds/periodos-trabajo/nuevo${origenQ}`} editHref={(id) => `/cruds/periodos-trabajo/${id}/editar${origenQ}`} getId={(i) => i.id} searchPredicate={() => true} mobileBottomNav backHref="/dashboard" />;
}
