"use client";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearTarjeta } from "@/backend/src/actions/tarjetas";
import { tarjetaSchema, tarjetaFields } from "../tarjeta-form-config";
export default function NuevaTarjetaPage() {
  return <CrudForm title="Nueva Tarjeta" fields={tarjetaFields} schema={tarjetaSchema} onSubmit={async (d) => {
    await crearTarjeta({ nombre: d.nombre as string, banco: d.banco as string, numero: d.numero as string, cuenta: d.cuenta as string });
  }} cancelHref="/cruds/tarjetas" successMessage="Tarjeta creada correctamente" />;
}
