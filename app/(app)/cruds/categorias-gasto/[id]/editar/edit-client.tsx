"use client";

import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarCategoriaGasto } from "@/backend/src/actions/gastos";
import type { CategoriaGastoOut } from "@/backend/src/queries/gastos";
import { categoriaGastoSchema, categoriaGastoFields } from "../../categoria-gasto-form-config";

interface Props {
  data: CategoriaGastoOut;
  /** Origen de navegación (?origen=...). Si es "dashboard", Cancelar / volver
      regresan a la grilla conservando el origen (mantiene el botón volver). */
  origen?: string;
}

export function EditarCategoriaGastoClient({ data, origen }: Props) {
  const params = useParams();
  const destino =
    origen === "dashboard"
      ? "/cruds/categorias-gasto?origen=dashboard"
      : "/cruds/categorias-gasto";

  return (
    <CrudForm
      title="Editar Categoría de Gasto"
      fields={categoriaGastoFields}
      schema={categoriaGastoSchema}
      defaultValues={{ nombre: data.nombre }}
      onSubmit={async (formData) => {
        await actualizarCategoriaGasto(Number(params.id), {
          nombre: formData.nombre as string,
        });
      }}
      cancelHref={destino}
      successHref={destino}
      successMessage="Categoría actualizada correctamente"
    />
  );
}
