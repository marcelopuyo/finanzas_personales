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
  /** Origen de navegación (?origen=...). Si es "dashboard" se muestra el botón
      volver al dashboard y se propaga al "+" y al editar (patrón mobile app). */
  origen?: string;
}

export function CategoriasGastoListClient({ initialData, origen }: Props) {
  // Flecha "volver al dashboard" solo cuando se viene del panel del dashboard
  // (?origen=dashboard); el "+" y el editar conservan el origen para el viaje
  // de ida y vuelta.
  const desdeDashboard = origen === "dashboard";
  const origenQ = desdeDashboard ? "?origen=dashboard" : "";
  return (
    <CrudTable<CategoriaGastoOut>
      title="Categorías de Gasto"
      columns={columns}
      initialData={initialData}
      deleteItem={eliminarCategoriaGasto}
      searchPlaceholder="Buscar categoría..."
      createHref={`/cruds/categorias-gasto/nuevo${origenQ}`}
      editHref={(id) => `/cruds/categorias-gasto/${id}/editar${origenQ}`}
      getId={(item) => item.id}
      searchPredicate={(item, query) =>
        item.nombre.toLowerCase().includes(query)
      }
      backHref={desdeDashboard ? "/dashboard" : undefined}
      mobileBottomNav
    />
  );
}
