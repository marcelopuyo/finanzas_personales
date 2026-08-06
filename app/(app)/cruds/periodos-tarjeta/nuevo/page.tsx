"use client";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearPeriodoTarjeta } from "@/backend/src/actions/tarjetas";
import { periodoTarjetaSchema, periodoTarjetaFields } from "../periodo-tarjeta-form-config";
export default function NuevoPeriodoTarjetaPage() {
  return <CrudForm title="Nuevo Período de Tarjeta" fields={periodoTarjetaFields} schema={periodoTarjetaSchema} onSubmit={async (d) => {
    await crearPeriodoTarjeta({ nombre: d.nombre as string, fechaApertura: d.fechaApertura as string, fechaCierre: d.fechaCierre as string, fechaVencimiento: d.fechaVencimiento as string, tarjeta: d.tarjeta as string });
  }} cancelHref="/cruds/periodos-tarjeta" successMessage="Período creado correctamente" />;
}
