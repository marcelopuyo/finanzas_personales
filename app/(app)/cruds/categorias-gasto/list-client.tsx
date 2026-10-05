"use client";

import { CrudTable } from "@/components/crud/CrudTable";
import { usePendingNav } from "@/components/ui/nav-progress";
import type { CategoriaGastoOut } from "@/backend/src/queries/gastos";
import { eliminarCategoriaGasto } from "@/backend/src/actions/gastos";
import type { ColumnDef } from "@tanstack/react-table";
import { sufijoOrigen, volverDeOrigen } from "@/lib/origen-crud";

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
    <span className="block text-[14px] leading-snug break-words text-header">
      {c.nombre}
    </span>
  );
}

interface Props {
  initialData: CategoriaGastoOut[];
  /** Origen de navegación (?origen=<vista del dashboard>). De ahí sale la flecha
      "volver" del listado y se propaga al "+" y al editar (patrón mobile app).
      Ver `lib/origen-crud.ts`. */
  origen?: string;
}

export function CategoriasGastoListClient({ initialData, origen }: Props) {
  // La flecha "volver" va a la VISTA desde la que se abrió el CRUD (Gastos, si
  // vino de su panel); el "+" y el editar conservan el origen para el viaje de
  // ida y vuelta.
  const volver = volverDeOrigen(origen);
  const origenQ = sufijoOrigen(origen);
  // Navegación con feedback (barra de progreso global) para el toque de tarjeta.
  const { go: nav } = usePendingNav();
  return (
    <CrudTable<CategoriaGastoOut>
      title="Categorías de Gasto"
      columns={columns}
      initialData={initialData}
      // Sin paginación: la lista va completa y se scrollea (pedido del usuario).
      sinPaginacion
      deleteItem={eliminarCategoriaGasto}
      searchPlaceholder="Buscar categoría..."
      createHref={`/cruds/categorias-gasto/nuevo${origenQ}`}
      editHref={(id) => `/cruds/categorias-gasto/${id}/editar${origenQ}`}
      getId={(item) => item.id}
      searchPredicate={(item, query) =>
        item.nombre.toLowerCase().includes(query)
      }
      backHref={volver}
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
