"use client";

import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarCategoriaGasto } from "@/backend/src/actions/gastos";
import type { CategoriaGastoOut } from "@/backend/src/queries/gastos";
import { categoriaGastoSchema, categoriaGastoFields } from "../../categoria-gasto-form-config";

interface Props {
  data: CategoriaGastoOut;
}

export function EditarCategoriaGastoClient({ data }: Props) {
  const params = useParams();

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
      cancelHref="/cruds/categorias-gasto"
      successMessage="Categoría actualizada correctamente"
    />
  );
}
