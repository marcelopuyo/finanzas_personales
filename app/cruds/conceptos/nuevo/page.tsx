"use client";

import { CrudForm } from "@/components/crud/CrudForm";
import { createConcepto } from "@/lib/api/endpoints/maestros.api";
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
        await createConcepto({
          nombre: data.nombre as string,
          categoria: data.categoria as string,
        });
      }}
      cancelHref="/cruds/conceptos"
      successMessage="Concepto creado correctamente"
    />
  );
}
