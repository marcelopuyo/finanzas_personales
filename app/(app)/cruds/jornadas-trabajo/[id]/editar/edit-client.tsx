"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarJornadaTrabajo } from "@/backend/src/actions/trabajos";
import type { JornadaTrabajoOut } from "@/backend/src/queries/trabajos";
import { jornadaTrabajoSchema, jornadaTrabajoFieldsEditar } from "../../jornada-trabajo-form-config";
import { decimalToTime, timeToDecimal } from "@/lib/utils";
const dt = (v: Date) => String(v).slice(0, 10);
interface Props { data: JornadaTrabajoOut & { periodoTrabajoId?: number } }
export function EditarJornadaTrabajoClient({ data }: Props) {
  const p = useParams();
  return <CrudForm title="Editar Jornada de Trabajo" fields={jornadaTrabajoFieldsEditar} schema={jornadaTrabajoSchema} defaultValues={{ fechaJornada: dt(data.fechaJornada), horaDesde: decimalToTime(data.horaDesde), horaHasta: decimalToTime(data.horaHasta), montoPropina: data.montoPropina, idPeriodo: data.periodoTrabajoId ? String(data.periodoTrabajoId) : undefined }} onSubmit={async (f) => {
    const idPeriodo = f.idPeriodo as string;
    await actualizarJornadaTrabajo(String(p.id), {
      fechaJornada: f.fechaJornada as string,
      horaDesde: timeToDecimal(f.horaDesde as string),
      horaHasta: timeToDecimal(f.horaHasta as string),
      montoPropina: f.montoPropina ? Number(f.montoPropina) : 0,
      ...(idPeriodo === "auto"
        ? { crearPeriodoAutomatico: true, idTrabajo: Number(f.idTrabajo) }
        : { idPeriodo: Number(idPeriodo) }),
    });
  }} cancelHref="/cruds/jornadas-trabajo" successMessage="Jornada actualizada correctamente" />;
}
