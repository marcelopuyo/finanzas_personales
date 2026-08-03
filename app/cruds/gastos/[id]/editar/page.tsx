"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CrudForm } from "@/components/crud/CrudForm";
import {
  getGastoById,
  updateGasto,
} from "@/lib/api/endpoints/gastos.api";
import { gastoSchema, gastoFields } from "../../gasto-form-config";
import type { ResponseGastoDto } from "@/types";

const toDateInput = (value?: string | Date): string =>
  value ? String(value).slice(0, 10) : "";

export default function EditarGastoPage() {
  const params = useParams();
  const [data, setData] = useState<ResponseGastoDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGastoById(String(params.id))
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
        <p className="text-[13px] text-danger">Gasto no encontrado</p>
      </div>
    );
  }

  return (
    <CrudForm
      title="Editar Gasto"
      fields={gastoFields}
      schema={gastoSchema}
      defaultValues={{
        descripcion: data.descripcion || "",
        monto: data.monto,
        saldo: data.saldo,
        fechaVencimiento: toDateInput(data.fechaVencimiento),
        fechaPago: toDateInput(data.fechaPago),
        categoria: data.categoria?.nombre || "",
        periodo: data.periodo?.nombre || "",
      }}
      onSubmit={async (formData) => {
        await updateGasto(String(params.id), {
          descripcion: (formData.descripcion as string) || undefined,
          monto: Number(formData.monto),
          saldo: Number(formData.saldo),
          fechaVencimiento: formData.fechaVencimiento
            ? new Date(formData.fechaVencimiento as string)
            : undefined,
          fechaPago: formData.fechaPago
            ? new Date(formData.fechaPago as string)
            : undefined,
          nombreCategoria: formData.categoria as string,
          nombrePeriodo: formData.periodo as string,
        });
      }}
      cancelHref="/cruds/gastos"
      successMessage="Gasto actualizado correctamente"
    />
  );
}
