"use client";

import { CrudTable } from "@/components/crud/CrudTable";
import { usePendingNav } from "@/components/ui/nav-progress";
import type { PersonaOut } from "@/backend/src/queries/maestros";
import { eliminarPersona } from "@/backend/src/actions/maestros";
import type { ColumnDef } from "@tanstack/react-table";
import { sufijoOrigen, volverDeOrigen } from "@/lib/origen-crud";

const columns: ColumnDef<PersonaOut>[] = [
  { accessorKey: "nombre", header: "Nombre" },
  {
    accessorKey: "telefono",
    header: "Teléfono",
    cell: ({ getValue }) => getValue<string | null>() ?? "—",
  },
  {
    accessorKey: "mail",
    header: "Email",
    cell: ({ getValue }) => getValue<string | null>() ?? "—",
  },
];

/**
 * TARJETA de una persona en la grilla mobile (2026-09-19, mismo patrón que
 * trabajos/cuentas/préstamos: tarjetas + swipe, sin barra inferior).
 *
 * **nombre** arriba (sin truncar: si es largo hace varias líneas y se lee
 * completo, igual que el detalle de los préstamos §129) y, debajo en gris chico,
 * el **contacto** (`teléfono · mail`, solo los datos que existan; si no hay
 * ninguno lo dice explícitamente en vez de dejar la línea vacía). El teléfono
 * queda a un toque de distancia en el celular, que es donde más se usa.
 */
function PersonaCard({ p }: { p: PersonaOut }) {
  const contacto = [p.telefono, p.mail].filter(Boolean).join(" · ");
  return (
    <>
      <span className="block text-[14px] leading-snug break-words text-header">
        {p.nombre}
      </span>
      <p className="mt-0.5 truncate text-[11.5px] text-subtitle">
        {contacto || "Sin datos de contacto"}
      </p>
    </>
  );
} interface Props {
  initialData: PersonaOut[];
  /** Origen de navegación (?origen=<vista del dashboard>): de ahí sale la flecha
      "volver" del listado (Préstamos, que es su único punto de entrada) y el
      origen se propaga al "+"/editar. Ver `lib/origen-crud.ts`. */
  origen?: string;
}

export function PersonasListClient({ initialData, origen }: Props) {
  const volver = volverDeOrigen(origen);
  const origenQ = sufijoOrigen(origen);
  // Navegación con feedback (barra de progreso global) para el toque de tarjeta.
  const { go: nav } = usePendingNav();
  return (
    <CrudTable<PersonaOut>
      title="Personas"
      columns={columns}
      initialData={initialData}
      // Sin paginación: la lista va completa y se scrollea (pedido del usuario).
      sinPaginacion
      deleteItem={eliminarPersona}
      searchPlaceholder="Buscar persona..."
      createHref={`/cruds/personas/nuevo${origenQ}`}
      editHref={(id) => `/cruds/personas/${id}/editar${origenQ}`}
      getId={(i) => i.id}
      searchPredicate={(i, q) => i.nombre.toLowerCase().includes(q)}
      backHref={volver}
      mobileBottomNav
      // Mobile: cada persona es una TARJETA y el toque abre la edición; el
      // swipe revela Editar/Eliminar (los aporta `CrudTable`). La barra inferior
      // queda solo con el FAB "Nuevo" y ya no hace falta el `mobileHint`
      // ("Tocá una fila para seleccionarla": con swipe la fila no se selecciona).
      mobileRow={(p) => <PersonaCard p={p} />}
      mobileSwipe={{
        onRowTap: (id) => nav(`/cruds/personas/${id}/editar${origenQ}`, "row"),
      }}
    />
  );
}
