"use client";

import { CrudTable } from "@/components/crud/CrudTable";
import type { CategoriaGastoOut } from "@/backend/src/queries/gastos";
import { eliminarCategoriaGasto } from "@/backend/src/actions/gastos";
import type { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<CategoriaGastoOut>[] = [
  { accessorKey: "nombre", header: "Nombre" },
];

interface Props {
  initialData: CategoriaGastoOut[];
}

export function CategoriasGastoListClient({ initialData }: Props) {
  return (
    <CrudTable<CategoriaGastoOut>
      title="Categorías de Gasto"
      columns={columns}
      initialData={initialData}
      deleteItem={eliminarCategoriaGasto}
      searchPlaceholder="Buscar categoría..."
      createHref="/cruds/categorias-gasto/nuevo"
      editHref={(id) => `/cruds/categorias-gasto/${id}/editar`}
      getId={(item) => item.id}
      searchPredicate={(item, query) =>
        item.nombre.toLowerCase().includes(query)
      }
    />
  );
}
