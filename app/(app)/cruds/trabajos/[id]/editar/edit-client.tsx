"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarTrabajo } from "@/backend/src/actions/trabajos";
import type { TrabajoOut } from "@/backend/src/queries/trabajos";
import {
  trabajoSchema,
  trabajoFields,
  type TrabajoFormData,
} from "../../trabajo-form-config";
const dt = (v: Date) => String(v).slice(0, 10);
interface Props { data: TrabajoOut }
export function EditarTrabajoClient({ data }: Props) {
  const p = useParams();
  return <CrudForm title="Editar Trabajo" fields={trabajoFields} schema={trabajoSchema} defaultValues={{ nombre: data.nombre, fechaInicio: dt(data.fechaInicio), modalidadCobro: (data.modalidadCobro as TrabajoFormData["modalidadCobro"]) ?? "horas_variables", precioHora: data.precioHora ?? 0, memos: data.memos ?? "" }} onSubmit={async (f) => {
    const modalidad = f.modalidadCobro as string;
    await actualizarTrabajo(Number(p.id), {
      nombre: f.nombre as string,
      fechaInicio: f.fechaInicio as string,
      modalidadCobro: modalidad as
        | "fijo"
        | "por_tarea"
        | "horas_variables"
        | "horas_fijas",
      // precioHora solo aplica a modalidades por hora (fijo/por_tarea no lo usan).
      ...(modalidad !== "fijo" && modalidad !== "por_tarea"
        ? { precioHora: Number(f.precioHora) }
        : {}),
      memos: (f.memos as string) || undefined,
    });
  }} cancelHref="/cruds/trabajos" successMessage="Trabajo actualizado correctamente" />;
}
