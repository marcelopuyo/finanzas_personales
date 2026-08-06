"use client";

import { CrudTable } from "@/components/crud/CrudTable";
import type { ConceptoOut } from "@/backend/src/queries/maestros";
import { eliminarConcepto } from "@/backend/src/actions/maestros";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

const columns: ColumnDef<ConceptoOut>[] = [
  {
    accessorKey: "nombre",
    header: "Nombre",
  },
  {
    accessorKey: "categoria",
    header: "Categoría",
    cell: ({ getValue }) => {
      const cat = getValue<string | null>();
      return (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[12px] font-medium",
            cat === "Ingreso"
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          )}
        >
          {cat ?? "—"}
        </span>
      );
    },
  },
];

interface Props {
  initialData: ConceptoOut[];
}

export function ConceptosListClient({ initialData }: Props) {
  return (
    <CrudTable<ConceptoOut>
      title="Conceptos"
      columns={columns}
      initialData={initialData}
      deleteItem={eliminarConcepto}
      searchPlaceholder="Buscar concepto..."
      createHref="/admin/conceptos/nuevo"
      editHref={(id) => `/admin/conceptos/${id}/editar`}
      getId={(item) => item.id}
      searchPredicate={(item, query) =>
        item.nombre.toLowerCase().includes(query)
      }
    />
  );
}
