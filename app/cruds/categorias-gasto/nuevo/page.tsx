"use client";

import { CrudForm } from "@/components/crud/CrudForm";
import { crearCategoriaGasto } from "@/backend/src/actions/gastos";
import { categoriaGastoSchema, categoriaGastoFields } from "../categoria-gasto-form-config";

export default function NuevaCategoriaGastoPage() {
  return (
    <CrudForm
      title="Nueva Categoría de Gasto"
      fields={categoriaGastoFields}
      schema={categoriaGastoSchema}
      onSubmit={async (data) => {
        await crearCategoriaGasto({ nombre: data.nombre as string });
      }}
      cancelHref="/cruds/categorias-gasto"
      successMessage="Categoría creada correctamente"
    />
  );
}
