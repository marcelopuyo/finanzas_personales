"use client";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearTareaTrabajo } from "@/backend/src/actions/trabajos";
import {
  tareaTrabajoSchema,
  tareaTrabajoFields,
} from "../tarea-trabajo-form-config";

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DDTHH:mm" local actual (para el input datetime-local). */
function ahoraLocalInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Descripción precargada con la fecha/hora local (editable). */
function descripcionPrecargada(): string {
  const d = new Date();
  return `Tarea · ${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function NuevaTareaTrabajoPage() {
  return (
    <CrudForm
      title="Nueva Tarea de Trabajo"
      fields={tareaTrabajoFields}
      schema={tareaTrabajoSchema}
      defaultValues={{
        fechaHoraTarea: ahoraLocalInput(),
        descripcion: descripcionPrecargada(),
        idPeriodo: "",
        idTrabajo: "",
      }}
      onSubmit={async (d) => {
        const idPeriodo = d.idPeriodo as string;
        const descripcion = ((d.descripcion as string) ?? "").trim();
        const fechaLocal = (d.fechaHoraTarea as string).slice(0, 10);
        // Convierte la fecha/hora local elegida a ISO (instante) para guardar.
        const fechaHoraTarea = new Date(d.fechaHoraTarea as string).toISOString();
        await crearTareaTrabajo({
          fechaHoraTarea,
          // Fecha CALENDARIO LOCAL (la que ve el usuario en el input).
          fechaTarea: fechaLocal,
          descripcion: descripcion || undefined,
          horasTarea: d.horasTarea ? Number(d.horasTarea) : undefined,
          montoTarea: Number(d.montoTarea),
          ...(idPeriodo === "auto"
            ? { crearPeriodoAutomatico: true, idTrabajo: Number(d.idTrabajo) }
            : { idPeriodo: Number(idPeriodo), crearPeriodoAutomatico: false }),
        });
      }}
      cancelHref="/cruds/tareas-trabajo"
      successMessage="Tarea creada correctamente"
    />
  );
}
