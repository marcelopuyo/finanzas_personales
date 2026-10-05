"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearCuenta } from "@/backend/src/actions/maestros";
import { sufijoOrigen } from "@/lib/origen-crud";
import { cuentaSchema, cuentaFields } from "../cuenta-form-config";

function NuevaCuentaForm() {
  const searchParams = useSearchParams();
  // Abierto desde el CRUD (que a su vez viene de una vista del dashboard):
  // Cancelar / volver y el destino tras guardar van a la grilla CONSERVANDO el
  // origen, para que siga mostrando la flecha "volver" a esa vista (patrón
  // mobile app).
  const destino = `/cruds/cuentas${sufijoOrigen(searchParams.get("origen"))}`;
  return <CrudForm title="Nueva Cuenta" fields={cuentaFields} schema={cuentaSchema} defaultValues={{ incluirEnBalance: "true" }} onSubmit={async (d) => {
    await crearCuenta({ nombre: d.nombre as string, saldo: Number(d.saldo), tipo: d.tipo as string, moneda: d.moneda as string, incluirEnBalance: d.incluirEnBalance === "true" });
  }} cancelHref={destino} successHref={destino} successMessage="Cuenta creada correctamente" />;
}

export default function NuevaCuentaPage() {
  return (
    <Suspense fallback={null}>
      <NuevaCuentaForm />
    </Suspense>
  );
}
