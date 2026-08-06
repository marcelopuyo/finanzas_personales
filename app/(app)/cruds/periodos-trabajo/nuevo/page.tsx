"use client";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearPeriodoTrabajo } from "@/backend/src/actions/trabajos";
import { periodoTrabajoSchema, periodoTrabajoFields } from "../periodo-trabajo-form-config";
export default function NuevoPeriodoTrabajoPage() {
  return <CrudForm title="Nuevo Período de Trabajo" fields={periodoTrabajoFields} schema={periodoTrabajoSchema} onSubmit={async (d) => {
    await crearPeriodoTrabajo({ fechaDesde: d.fechaDesde as string, fechaHasta: d.fechaHasta as string, montoACobrar: d.montoACobrar ? Number(d.montoACobrar) : undefined, fechaEstimadaCobro: (d.fechaEstimadaCobro as string) || undefined, fechaDeCobro: (d.fechaDeCobro as string) || undefined, nombreTrabajo: d.nombreTrabajo as string });
  }} cancelHref="/cruds/periodos-trabajo" successMessage="Período creado correctamente" />;
}
