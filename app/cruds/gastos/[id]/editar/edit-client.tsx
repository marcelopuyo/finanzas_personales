"use client";

import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarGasto } from "@/backend/src/actions/gastos";
import type { GastoOut } from "@/backend/src/queries/gastos";
import { gastoSchema, gastoFields } from "../../gasto-form-config";

const toDateInput = (value?: Date | string | null): string =>
  value ? String(value).slice(0, 10) : "";

interface Props {
  data: GastoOut;
}

export function EditarGastoClient({ data }: Props) {
  const params = useParams();

  return (
    <CrudForm
      title="Editar Gasto"
      fields={gastoFields}
      schema={gastoSchema}
      defaultValues={{
        descripcion: data.descripcion ?? "",
        monto: data.monto,
        saldo: data.saldo,
        fechaVencimiento: toDateInput(data.fechaVencimiento),
        fechaPago: toDateInput(data.fechaPago),
        categoria: data.categoria?.nombre ?? "",
        periodo: data.periodo?.nombre ?? "",
      }}
      onSubmit={async (formData) => {
        await actualizarGasto(String(params.id), {
          descripcion: (formData.descripcion as string) || undefined,
          monto: Number(formData.monto),
          fechaVencimiento: (formData.fechaVencimiento as string) || undefined,
          nombreCategoria: formData.categoria as string,
          nombrePeriodo: formData.periodo as string,
        });
      }}
      cancelHref="/cruds/gastos"
      successMessage="Gasto actualizado correctamente"
    />
  );
}
