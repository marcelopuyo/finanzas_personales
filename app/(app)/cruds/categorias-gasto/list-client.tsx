"use client";

import { CrudTable } from "@/components/crud/CrudTable";
import { usePendingNav } from "@/components/ui/nav-progress";
import type { CategoriaGastoOut } from "@/backend/src/queries/gastos";
import { eliminarCategoriaGasto } from "@/backend/src/actions/gastos";
import type { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<CategoriaGastoOut>[] = [
  { accessorKey: "nombre", header: "Nombre" },
];

/**
 * TARJETA de una categoría en la grilla mobile (2026-09-19, mismo patrón que
 * trabajos/cuentas/préstamos: tarjetas + swipe, sin barra inferior).
 *
 * El registro solo tiene `nombre`, así que la tarjeta es una línea. **No
 * trunca**: si el nombre es largo hace varias líneas y se lee completo (misma
 * decisión que el detalle de los préstamos, §129).
 */
function CategoriaCard({ c }: { c: CategoriaGastoOut }) {
  return (
    <span className="block text-[14px] leading-snug font-semibold break-words text-header">
      {c.nombre}
    </span>
  );
}

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
  // Navegación con feedback (barra de progreso global) para el toque de tarjeta.
  const { go: nav } = usePendingNav();
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
      // Mobile: cada categoría es una TARJETA y el toque abre la edición; el
      // swipe revela Editar/Eliminar (los aporta `CrudTable`). La barra inferior
      // queda solo con el FAB "Nuevo".
      mobileRow={(c) => <CategoriaCard c={c} />}
      mobileSwipe={{
        onRowTap: (id) =>
          nav(`/cruds/categorias-gasto/${id}/editar${origenQ}`, "row"),
      }}
    />
  );
}
