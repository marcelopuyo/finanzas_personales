"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarTareaTrabajo } from "@/backend/src/actions/trabajos";
import type { TareaTrabajoOut } from "@/backend/src/queries/trabajos";
import {
  tareaTrabajoSchema,
  tareaTrabajoFieldsEditar,
} from "../../tarea-trabajo-form-config";

const pad = (n: number) => String(n).padStart(2, "0");

/** Convierte un instante (Date/string ISO) a "YYYY-MM-DDTHH:mm" LOCAL. */
function toLocalInput(v: Date | string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

interface Props {
  data: TareaTrabajoOut & {
    periodoTrabajoId?: number;
  };
}
export function EditarTareaTrabajoClient({ data }: Props) {
  const p = useParams();
  return (
    <CrudForm
      title="Editar Tarea de Trabajo"
      fields={tareaTrabajoFieldsEditar}
      schema={tareaTrabajoSchema}
      defaultValues={{
        fechaHoraTarea: toLocalInput(data.fechaHoraTarea),
        descripcion: data.descripcion ?? "",
        horasTarea: data.horasTarea ?? undefined,
        montoTarea: data.montoTarea ?? 0,
        idPeriodo: data.periodoTrabajoId ? String(data.periodoTrabajoId) : "",
      }}
      onSubmit={async (f) => {
        const descripcion = ((f.descripcion as string) ?? "").trim();
        const fechaLocal = (f.fechaHoraTarea as string).slice(0, 10);
        const fechaHoraTarea = new Date(
          f.fechaHoraTarea as string
        ).toISOString();
        await actualizarTareaTrabajo(String(p.id), {
          fechaHoraTarea,
          // Fecha CALENDARIO LOCAL (la que ve el usuario en el input).
          fechaTarea: fechaLocal,
          descripcion: descripcion || undefined,
          horasTarea: f.horasTarea ? Number(f.horasTarea) : undefined,
          montoTarea: Number(f.montoTarea),
          idPeriodo: f.idPeriodo ? Number(f.idPeriodo) : undefined,
        });
      }}
      cancelHref="/cruds/tareas-trabajo"
      successMessage="Tarea actualizada correctamente"
    />
  );
}
