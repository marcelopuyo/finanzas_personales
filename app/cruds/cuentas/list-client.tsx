"use client";
import { CrudTable } from "@/components/crud/CrudTable";
import type { CuentaOut } from "@/backend/src/queries/maestros";
import { eliminarCuenta } from "@/backend/src/actions/maestros";
import type { ColumnDef } from "@tanstack/react-table";
import { numberToCurrency } from "@/lib/utils";
const columns: ColumnDef<CuentaOut>[] = [
  { accessorKey: "nombre", header: "Nombre" },
  { accessorKey: "saldo", header: "Saldo", meta: { align: "right" as const }, cell: ({ getValue }) => numberToCurrency(getValue<number>() ?? 0) },
  { accessorFn: (r) => r.tipo?.nombre ?? "", id: "tipo", header: "Tipo" },
  { accessorFn: (r) => r.moneda?.nombre ?? "", id: "moneda", header: "Moneda" },
];
interface Props { initialData: CuentaOut[] }
export function CuentasListClient({ initialData }: Props) {
  return <CrudTable<CuentaOut> title="Cuentas" columns={columns} initialData={initialData} deleteItem={eliminarCuenta} searchPlaceholder="Buscar cuenta..." createHref="/cruds/cuentas/nuevo" editHref={(id) => `/cruds/cuentas/${id}/editar`} getId={(i) => i.id} searchPredicate={(i, q) => i.nombre.toLowerCase().includes(q)} />;
}
