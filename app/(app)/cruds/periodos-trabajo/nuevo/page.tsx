"use client";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearPeriodoTrabajo } from "@/backend/src/actions/trabajos";
import { periodoTrabajoSchema, periodoTrabajoFieldsNuevo } from "../periodo-trabajo-form-config";
export default function NuevoPeriodoTrabajoPage() {
  return <CrudForm title="Nuevo Período de Trabajo" fields={periodoTrabajoFieldsNuevo} schema={periodoTrabajoSchema} onSubmit={async (d) => {
    await crearPeriodoTrabajo({ fechaDesde: d.fechaDesde as string, fechaHasta: d.fechaHasta as string, fechaEstimadaCobro: (d.fechaEstimadaCobro as string) || undefined, nombreTrabajo: d.nombreTrabajo as string });
  }} cancelHref="/cruds/periodos-trabajo" successMessage="Período creado correctamente" />;
}
