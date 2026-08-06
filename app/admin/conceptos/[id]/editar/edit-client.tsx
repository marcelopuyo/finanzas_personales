"use client";

import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarConcepto } from "@/backend/src/actions/maestros";
import type { ConceptoOut } from "@/backend/src/queries/maestros";
import {
  conceptoSchema,
  conceptoFields,
} from "../../concepto-form-config";

interface Props {
  data: ConceptoOut;
}

export function EditarConceptoClient({ data }: Props) {
  const params = useParams();

  return (
    <CrudForm
      title="Editar Concepto"
      fields={conceptoFields}
      schema={conceptoSchema}
      defaultValues={{
        nombre: data.nombre,
        categoria: data.categoria ?? "",
      }}
      onSubmit={async (formData) => {
        await actualizarConcepto(Number(params.id), {
          nombre: formData.nombre as string,
          categoria: formData.categoria as "Egreso" | "Ingreso",
        });
      }}
      cancelHref="/admin/conceptos"
      successMessage="Concepto actualizado correctamente"
    />
  );
}
