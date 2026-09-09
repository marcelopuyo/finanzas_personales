"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearCategoriaGasto } from "@/backend/src/actions/gastos";
import { categoriaGastoSchema, categoriaGastoFields } from "../categoria-gasto-form-config";

function NuevaCategoriaGastoForm() {
  const searchParams = useSearchParams();
  // Abierto desde el dashboard (?origen=dashboard): Cancelar / volver y el
  // destino tras guardar van a la grilla CONSERVANDO el origen, para que siga
  // mostrando el botón "volver" al dashboard (patrón mobile app).
  const destino =
    searchParams.get("origen") === "dashboard"
      ? "/cruds/categorias-gasto?origen=dashboard"
      : "/cruds/categorias-gasto";
  return (
    <CrudForm
      title="Nueva Categoría de Gasto"
      fields={categoriaGastoFields}
      schema={categoriaGastoSchema}
      onSubmit={async (data) => {
        await crearCategoriaGasto({ nombre: data.nombre as string });
      }}
      cancelHref={destino}
      successHref={destino}
      successMessage="Categoría creada correctamente"
    />
  );
}

export default function NuevaCategoriaGastoPage() {
  return (
    <Suspense fallback={null}>
      <NuevaCategoriaGastoForm />
    </Suspense>
  );
}
