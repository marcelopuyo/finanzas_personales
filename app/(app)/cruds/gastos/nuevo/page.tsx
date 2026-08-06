"use client";

import { CrudForm } from "@/components/crud/CrudForm";
import { crearGasto } from "@/backend/src/actions/gastos";
import { gastoSchema, gastoFields } from "../gasto-form-config";

export default function NuevoGastoPage() {
  return (
    <CrudForm
      title="Nuevo Gasto"
      fields={gastoFields}
      schema={gastoSchema}
      onSubmit={async (data) => {
        await crearGasto({
          descripcion: (data.descripcion as string) || undefined,
          monto: Number(data.monto),
          saldo: Number(data.monto),
          isPeriodico: false,
          fechaVencimiento: (data.fechaVencimiento as string) || undefined,
          nombreCategoria: data.categoria as string,
          nombrePeriodo: data.periodo as string,
        });
      }}
      cancelHref="/cruds/gastos"
      successMessage="Gasto creado correctamente"
    />
  );
}
