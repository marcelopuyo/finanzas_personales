"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarPeriodoTrabajo } from "@/backend/src/actions/trabajos";
import type { PeriodoTrabajoOut } from "@/backend/src/queries/trabajos";
import { periodoTrabajoSchema, periodoTrabajoFields } from "../../periodo-trabajo-form-config";
const dt = (v: Date | null) => (v ? String(v).slice(0, 10) : "");
interface Props { data: PeriodoTrabajoOut }
export function EditarPeriodoTrabajoClient({ data }: Props) {
  const p = useParams();
  return <CrudForm title="Editar Período de Trabajo" fields={periodoTrabajoFields} schema={periodoTrabajoSchema} defaultValues={{ fechaDesde: dt(data.fechaDesde), fechaHasta: dt(data.fechaHasta), montoACobrar: data.montoACobrar ?? undefined, fechaEstimadaCobro: dt(data.fechaEstimadaCobro), fechaDeCobro: dt(data.fechaDeCobro), nombreTrabajo: data.trabajo?.nombre ?? "" }} onSubmit={async (f) => {
    await actualizarPeriodoTrabajo(Number(p.id), { fechaDesde: f.fechaDesde as string, fechaHasta: f.fechaHasta as string, montoACobrar: f.montoACobrar ? Number(f.montoACobrar) : undefined, fechaEstimadaCobro: (f.fechaEstimadaCobro as string) || undefined, fechaDeCobro: (f.fechaDeCobro as string) || undefined, nombreTrabajo: f.nombreTrabajo as string });
  }} cancelHref="/cruds/periodos-trabajo" successMessage="Período actualizado correctamente" />;
}
