"use client";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearTrabajo } from "@/backend/src/actions/trabajos";
import { trabajoSchema, trabajoFields } from "../trabajo-form-config";
export default function NuevoTrabajoPage() {
  return <CrudForm title="Nuevo Trabajo" fields={trabajoFields} schema={trabajoSchema} onSubmit={async (d) => {
    await crearTrabajo({ nombre: d.nombre as string, fechaInicio: d.fechaInicio as string, precioHora: Number(d.precioHora), memos: (d.memos as string) || undefined });
  }} cancelHref="/cruds/trabajos" successMessage="Trabajo creado correctamente" />;
}
