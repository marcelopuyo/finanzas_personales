"use client";

import { CrudForm } from "@/components/crud/CrudForm";
import { crearConcepto } from "@/backend/src/actions/maestros";
import {
  conceptoSchema,
  conceptoFields,
} from "../concepto-form-config";

export default function NuevoConceptoPage() {
  return (
    <CrudForm
      title="Nuevo Concepto"
      fields={conceptoFields}
      schema={conceptoSchema}
      onSubmit={async (data) => {
        await crearConcepto({
          nombre: data.nombre as string,
          categoria: data.categoria as "Egreso" | "Ingreso",
        });
      }}
      cancelHref="/cruds/conceptos"
      successMessage="Concepto creado correctamente"
    />
  );
}
