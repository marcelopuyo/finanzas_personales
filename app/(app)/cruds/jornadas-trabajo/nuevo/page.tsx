"use client";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearJornadaTrabajo } from "@/backend/src/actions/trabajos";
import { jornadaTrabajoSchema, jornadaTrabajoFields } from "../jornada-trabajo-form-config";
import { timeToDecimal } from "@/lib/utils";
export default function NuevaJornadaTrabajoPage() {
  return <CrudForm title="Nueva Jornada de Trabajo" fields={jornadaTrabajoFields} schema={jornadaTrabajoSchema} onSubmit={async (d) => {
    const idPeriodo = d.idPeriodo as string;
    await crearJornadaTrabajo({
      fechaJornada: d.fechaJornada as string,
      horaDesde: timeToDecimal(d.horaDesde as string),
      horaHasta: timeToDecimal(d.horaHasta as string),
      montoPropina: d.montoPropina ? Number(d.montoPropina) : 0,
      ...(idPeriodo === "auto"
        ? { crearPeriodoAutomatico: true, idTrabajo: Number(d.idTrabajo) }
        : { idPeriodo: Number(idPeriodo), crearPeriodoAutomatico: false }),
    });
  }} cancelHref="/cruds/jornadas-trabajo" successMessage="Jornada creada correctamente" />;
}
