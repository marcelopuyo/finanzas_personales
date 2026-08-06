"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarTrabajo } from "@/backend/src/actions/trabajos";
import type { TrabajoOut } from "@/backend/src/queries/trabajos";
import { trabajoSchema, trabajoFields } from "../../trabajo-form-config";
const dt = (v: Date) => String(v).slice(0, 10);
interface Props { data: TrabajoOut }
export function EditarTrabajoClient({ data }: Props) {
  const p = useParams();
  return <CrudForm title="Editar Trabajo" fields={trabajoFields} schema={trabajoSchema} defaultValues={{ nombre: data.nombre, fechaInicio: dt(data.fechaInicio), precioHora: data.precioHora, memos: data.memos ?? "" }} onSubmit={async (f) => {
    await actualizarTrabajo(Number(p.id), { nombre: f.nombre as string, fechaInicio: f.fechaInicio as string, precioHora: Number(f.precioHora), memos: (f.memos as string) || undefined });
  }} cancelHref="/cruds/trabajos" successMessage="Trabajo actualizado correctamente" />;
}
