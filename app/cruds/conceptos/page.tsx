"use client";

import { CrudTable } from "@/components/crud/CrudTable";
import type { ResponseConceptoDto } from "@/types";
import {
  getAllConceptos,
  deleteConcepto,
} from "@/lib/api/endpoints/maestros.api";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";

const columns: ColumnDef<ResponseConceptoDto>[] = [
  {
    accessorKey: "nombre",
    header: "Nombre",
  },
  {
    accessorKey: "categoria",
    header: "Categoría",
    cell: ({ getValue }) => {
      const cat = getValue<string>();
      return (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[12px] font-medium",
            cat === "Ingreso"
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          )}
        >
          {cat}
        </span>
      );
    },
  },
];

export default function ConceptosPage() {
  return (
    <CrudTable<ResponseConceptoDto>
      title="Conceptos"
      columns={columns}
      fetchData={getAllConceptos}
      deleteItem={deleteConcepto}
      searchPlaceholder="Buscar concepto..."
      createHref="/cruds/conceptos/nuevo"
      editHref={(id) => `/cruds/conceptos/${id}/editar`}
      getId={(item) => item.id}
      searchPredicate={(item, query) =>
        item.nombre.toLowerCase().includes(query)
      }
    />
  );
}
