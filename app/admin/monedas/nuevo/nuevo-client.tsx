"use client";

import { CrudForm } from "@/components/crud/CrudForm";
import { crearMoneda } from "@/backend/src/actions/maestros";
import { monedaSchema, monedaFields } from "../moneda-form-config";

export function NuevaMonedaClient() {
  return (
    <CrudForm
      title="Nueva Moneda"
      fields={monedaFields}
      schema={monedaSchema}
      onSubmit={async (d) => {
        await crearMoneda({
          simbolo: d.simbolo as string,
          nombre: d.nombre as string,
          codigoISO: d.codigoISO as string,
        });
      }}
      cancelHref="/admin/monedas"
      successMessage="Moneda creada correctamente"
    />
  );
}
