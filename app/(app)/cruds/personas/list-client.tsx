"use client";

import { CrudTable } from "@/components/crud/CrudTable";
import { usePendingNav } from "@/components/ui/nav-progress";
import type { PersonaOut } from "@/backend/src/queries/maestros";
import { eliminarPersona } from "@/backend/src/actions/maestros";
import type { ColumnDef } from "@tanstack/react-table";

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
      <span className="block text-[14px] leading-snug font-semibold break-words text-header">
        {p.nombre}
      </span>
      <p className="mt-0.5 truncate text-[11.5px] text-subtitle">
        {contacto || "Sin datos de contacto"}
      </p>
    </>
  );
} interface Props {
  initialData: PersonaOut[];
}

export function PersonasListClient({ initialData }: Props) {
  // Navegación con feedback (barra de progreso global) para el toque de tarjeta.
  const { go: nav } = usePendingNav();
  return (
    <CrudTable<PersonaOut>
      title="Personas"
      columns={columns}
      initialData={initialData}
      deleteItem={eliminarPersona}
      searchPlaceholder="Buscar persona..."
      createHref="/cruds/personas/nuevo"
      editHref={(id) => `/cruds/personas/${id}/editar`}
      getId={(i) => i.id}
      searchPredicate={(i, q) => i.nombre.toLowerCase().includes(q)}
      backHref="/dashboard"
      mobileBottomNav
      // Mobile: cada persona es una TARJETA y el toque abre la edición; el
      // swipe revela Editar/Eliminar (los aporta `CrudTable`). La barra inferior
      // queda solo con el FAB "Nuevo" y ya no hace falta el `mobileHint`
      // ("Tocá una fila para seleccionarla": con swipe la fila no se selecciona).
      mobileRow={(p) => <PersonaCard p={p} />}
      mobileSwipe={{
        onRowTap: (id) => nav(`/cruds/personas/${id}/editar`, "row"),
      }}
    />
  );
}
