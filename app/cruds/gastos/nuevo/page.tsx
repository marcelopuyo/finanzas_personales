"use client";

import { CrudForm } from "@/components/crud/CrudForm";
import { createGasto } from "@/lib/api/endpoints/gastos.api";
import { gastoSchema, gastoFields } from "../gasto-form-config";

export default function NuevoGastoPage() {
  return (
    <CrudForm
      title="Nuevo Gasto"
      fields={gastoFields}
      schema={gastoSchema}
      onSubmit={async (data) => {
        await createGasto({
          descripcion: (data.descripcion as string) || undefined,
          monto: Number(data.monto),
          saldo: Number(data.saldo),
          fechaVencimiento: data.fechaVencimiento
            ? new Date(data.fechaVencimiento as string)
            : undefined,
          fechaPago: data.fechaPago
            ? new Date(data.fechaPago as string)
            : undefined,
          nombreCategoria: data.categoria as string,
          nombrePeriodo: data.periodo as string,
        });
      }}
      cancelHref="/cruds/gastos"
      successMessage="Gasto creado correctamente"
    />
  );
}
