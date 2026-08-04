"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarJornadaTrabajo } from "@/backend/src/actions/trabajos";
import type { JornadaTrabajoOut } from "@/backend/src/queries/trabajos";
import { jornadaTrabajoSchema, jornadaTrabajoFields } from "../../jornada-trabajo-form-config";
import { decimalToTime, timeToDecimal } from "@/lib/utils";
const dt = (v: Date) => String(v).slice(0, 10);
interface Props { data: JornadaTrabajoOut & { periodoTrabajoId?: number } }
export function EditarJornadaTrabajoClient({ data }: Props) {
  const p = useParams();
  return <CrudForm title="Editar Jornada de Trabajo" fields={jornadaTrabajoFields} schema={jornadaTrabajoSchema} defaultValues={{ fechaJornada: dt(data.fechaJornada), horaDesde: decimalToTime(data.horaDesde), horaHasta: decimalToTime(data.horaHasta), montoPropina: data.montoPropina, idPeriodo: data.periodoTrabajoId ?? undefined }} onSubmit={async (f) => {
    await actualizarJornadaTrabajo(String(p.id), { fechaJornada: f.fechaJornada as string, horaDesde: timeToDecimal(f.horaDesde as string), horaHasta: timeToDecimal(f.horaHasta as string), montoPropina: f.montoPropina ? Number(f.montoPropina) : 0, idPeriodo: Number(f.idPeriodo) });
  }} cancelHref="/cruds/jornadas-trabajo" successMessage="Jornada actualizada correctamente" />;
}
