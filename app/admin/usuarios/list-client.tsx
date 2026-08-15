"use client";

import { CrudTable } from "@/components/crud/CrudTable";
import type { UsuarioOut } from "@/backend/src/queries/usuarios";
import { eliminarUsuarioAdmin } from "@/backend/src/actions/usuarios";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { dateTimeToString } from "@/lib/utils";

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
    accessorKey: "creadoEn",
    header: "Registro",
    cell: ({ getValue }) => dateTimeToString(getValue<Date>()),
    meta: { align: "center" as const, exportValue: (row: UsuarioOut) => dateTimeToString(row.creadoEn) },
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
