"use client";

import { CrudForm } from "@/components/crud/CrudForm";
import { crearTipoCuenta } from "@/backend/src/actions/maestros";
import { tipoCuentaSchema, tipoCuentaFields } from "../tipo-cuenta-form-config";

export function NuevoTipoCuentaClient() {
  return (
    <CrudForm
      title="Nuevo Tipo de Cuenta"
      fields={tipoCuentaFields}
      schema={tipoCuentaSchema}
      onSubmit={async (data) => {
        await crearTipoCuenta({ nombre: data.nombre as string });
      }}
      cancelHref="/admin/tipos-cuenta"
      successMessage="Tipo de cuenta creado correctamente"
    />
  );
}
