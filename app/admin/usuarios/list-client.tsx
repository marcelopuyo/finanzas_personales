"use client";

import { CrudTable } from "@/components/crud/CrudTable";
import type { UsuarioOut } from "@/backend/src/queries/usuarios";
import { eliminarUsuarioAdmin } from "@/backend/src/actions/usuarios";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

function Badge({
  ok,
  label,
}: {
  ok: boolean;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium",
        ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          ok ? "bg-success" : "bg-danger"
        )}
      />
      {label ?? (ok ? "Sí" : "No")}
    </span>
  );
}

const columns: ColumnDef<UsuarioOut>[] = [
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "nombre",
    header: "Nombre",
    cell: ({ getValue }) => (getValue<string | null>() ?? "—"),
  },
  {
    accessorKey: "emailVerificado",
    header: "Verificado",
    cell: ({ getValue }) => <Badge ok={!!getValue()} />,
  },
  {
    accessorKey: "activo",
    header: "Activo",
    cell: ({ getValue }) => <Badge ok={!!getValue()} />,
  },
  {
    accessorKey: "esAdmin",
    header: "Admin",
    cell: ({ getValue }) => (
      <Badge ok={!!getValue()} label="Admin" />
    ),
  },
];

interface Props {
  initialData: UsuarioOut[];
}

export function UsuariosListClient({ initialData }: Props) {
  return (
    <CrudTable<UsuarioOut>
      title="Usuarios"
      columns={columns}
      initialData={initialData}
      deleteItem={eliminarUsuarioAdmin}
      searchPlaceholder="Buscar por email o nombre..."
      createHref="/admin/usuarios/nuevo"
      editHref={(id) => `/admin/usuarios/${id}/editar`}
      getId={(u) => u.id}
      searchPredicate={(u, q) =>
        u.email.toLowerCase().includes(q) ||
        (u.nombre ?? "").toLowerCase().includes(q)
      }
    />
  );
}
