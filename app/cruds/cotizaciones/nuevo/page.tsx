"use client";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearCotizacion } from "@/backend/src/actions/maestros";
import { cotizacionSchema, cotizacionFields } from "../cotizacion-form-config";
export default function NuevaCotizacionPage() {
  return <CrudForm title="Nueva Cotización" fields={cotizacionFields} schema={cotizacionSchema} onSubmit={async (d) => {
    await crearCotizacion({ fechaInicial: d.fechaInicial as string, fechaFinal: d.fechaFinal as string, cotizacion: Number(d.cotizacion), moneda: d.moneda as string });
  }} cancelHref="/cruds/cotizaciones" successMessage="Cotización creada correctamente" />;
}
