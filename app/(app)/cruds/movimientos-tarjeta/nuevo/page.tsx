"use client";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearMovimientoTarjeta } from "@/backend/src/actions/tarjetas";
import { movimientoTarjetaSchema, movimientoTarjetaFields } from "../movimiento-tarjeta-form-config";
export default function NuevoMovimientoTarjetaPage() {
  return <CrudForm title="Nuevo Movimiento de Tarjeta" fields={movimientoTarjetaFields} schema={movimientoTarjetaSchema} onSubmit={async (d) => {
    await crearMovimientoTarjeta({ detalle: (d.detalle as string) || undefined, fecha: d.fecha as string, monto: Number(d.monto), cuotas: Number(d.cuotas), persona: d.persona as string, tarjeta: d.tarjeta as string, periodo: d.periodo as string });
  }} cancelHref="/cruds/movimientos-tarjeta" successMessage="Movimiento creado correctamente" />;
}
