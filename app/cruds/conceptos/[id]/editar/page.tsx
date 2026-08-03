"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CrudForm } from "@/components/crud/CrudForm";
import {
  getConceptoById,
  updateConcepto,
} from "@/lib/api/endpoints/maestros.api";
import {
  conceptoSchema,
  conceptoFields,
} from "../../concepto-form-config";
import type { ResponseConceptoDto } from "@/types";

export default function EditarConceptoPage() {
  const params = useParams();
  const [data, setData] = useState<ResponseConceptoDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConceptoById(Number(params.id))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[13px] text-subtitle">Cargando...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-[13px] text-danger">Concepto no encontrado</p>
      </div>
    );
  }

  return (
    <CrudForm
      title="Editar Concepto"
      fields={conceptoFields}
      schema={conceptoSchema}
      defaultValues={{
        nombre: data.nombre,
        categoria: data.categoria,
      }}
      onSubmit={async (formData) => {
        await updateConcepto(Number(params.id), {
          nombre: formData.nombre as string,
          categoria: formData.categoria as string,
        });
      }}
      cancelHref="/cruds/conceptos"
      successMessage="Concepto actualizado correctamente"
    />
  );
}
