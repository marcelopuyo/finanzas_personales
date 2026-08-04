"use client";
import { CrudTable } from "@/components/crud/CrudTable";
import type { TarjetaOut } from "@/backend/src/queries/tarjetas";
import { eliminarTarjeta } from "@/backend/src/actions/tarjetas";
import type { ColumnDef } from "@tanstack/react-table";
const columns: ColumnDef<TarjetaOut>[] = [
  { accessorKey: "nombre", header: "Nombre" },
  { accessorKey: "banco", header: "Banco" },
  { accessorKey: "numero", header: "Número" },
  { accessorFn: (r) => r.cuenta?.nombre ?? "", id: "cuenta", header: "Cuenta" },
];
interface Props { initialData: TarjetaOut[] }
export function TarjetasListClient({ initialData }: Props) {
  return <CrudTable<TarjetaOut> title="Tarjetas" columns={columns} initialData={initialData} deleteItem={eliminarTarjeta} searchPlaceholder="Buscar tarjeta..." createHref="/cruds/tarjetas/nuevo" editHref={(id) => `/cruds/tarjetas/${id}/editar`} getId={(i) => i.id} searchPredicate={(i, q) => i.nombre.toLowerCase().includes(q) || i.banco.toLowerCase().includes(q)} />;
}
