"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarTareaTrabajo } from "@/backend/src/actions/trabajos";
import type { TareaTrabajoOut } from "@/backend/src/queries/trabajos";
import {
  tareaTrabajoSchema,
  tareaTrabajoSchemaEnPeriodo,
  tareaTrabajoFieldsEditar,
  tareaTrabajoFieldsEditarEnPeriodo,
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
  /** Edición lanzada desde la pantalla de un período: el período queda FIJO
      (sin selector) y al guardar/cancelar se vuelve a esa pantalla (volverA). */
  periodoFijo?: boolean;
  volverA?: string;
}
export function EditarTareaTrabajoClient({
  data,
  periodoFijo = false,
  volverA,
}: Props) {
  const p = useParams();
  const back = volverA || "/cruds/tareas-trabajo";
  // En modo período fijo el id del período sale de la tarea (el form no tiene
  // selector de período y la BD no permite "auto" desde acá).
  const idPeriodoFijo = data.periodoTrabajoId
    ? String(data.periodoTrabajoId)
    : undefined;
  return (
    <CrudForm
      title="Editar Tarea de Trabajo"
      fields={
        periodoFijo
          ? tareaTrabajoFieldsEditarEnPeriodo
          : tareaTrabajoFieldsEditar
      }
      schema={periodoFijo ? tareaTrabajoSchemaEnPeriodo : tareaTrabajoSchema}
      defaultValues={{
        fechaHoraTarea: toLocalInput(data.fechaHoraTarea),
        descripcion: data.descripcion ?? "",
        horasTarea: data.horasTarea ?? undefined,
        montoTarea: data.montoTarea ?? 0,
        idPeriodo: idPeriodoFijo ?? "",
      }}
      onSubmit={async (f) => {
        const idPeriodo = periodoFijo
          ? idPeriodoFijo
          : (f.idPeriodo as string);
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
          ...(idPeriodo ? { idPeriodo: Number(idPeriodo) } : {}),
        });
      }}
      cancelHref={back}
      successMessage="Tarea actualizada correctamente"
    />
  );
}
