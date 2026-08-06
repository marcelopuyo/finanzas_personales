"use client";
import { CrudTable } from "@/components/crud/CrudTable";
import type { TrabajoOut } from "@/backend/src/queries/trabajos";
import { eliminarTrabajo } from "@/backend/src/actions/trabajos";
import type { ColumnDef } from "@tanstack/react-table";
import { dateTimeToString, numberToCurrency } from "@/lib/utils";
const columns: ColumnDef<TrabajoOut>[] = [
  { accessorKey: "nombre", header: "Nombre" },
  { accessorKey: "fechaInicio", header: "Inicio", cell: ({ getValue }) => dateTimeToString(getValue<Date>()), meta: { align: "center" as const } },
  { accessorKey: "precioHora", header: "Precio Hora", meta: { align: "right" as const, isCurrency: true }, cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0) },
];
interface Props { initialData: TrabajoOut[] }
export function TrabajosListClient({ initialData }: Props) {
  return <CrudTable<TrabajoOut> title="Trabajos" columns={columns} initialData={initialData} deleteItem={eliminarTrabajo} searchPlaceholder="Buscar trabajo..." createHref="/cruds/trabajos/nuevo" editHref={(id) => `/cruds/trabajos/${id}/editar`} getId={(i) => i.id} searchPredicate={(i, q) => i.nombre.toLowerCase().includes(q)} />;
}
