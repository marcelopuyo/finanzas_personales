"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearCategoriaGasto } from "@/backend/src/actions/gastos";
import { sufijoOrigen } from "@/lib/origen-crud";
import { categoriaGastoSchema, categoriaGastoFields } from "../categoria-gasto-form-config";

function NuevaCategoriaGastoForm() {
  const searchParams = useSearchParams();
  // Abierto desde el CRUD (que a su vez viene de una vista del dashboard):
  // Cancelar / volver y el destino tras guardar van a la grilla CONSERVANDO el
  // origen, para que siga mostrando la flecha "volver" a esa vista (patrón
  // mobile app).
  const destino = `/cruds/categorias-gasto${sufijoOrigen(searchParams.get("origen"))}`;
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
