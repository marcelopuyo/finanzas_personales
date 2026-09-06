"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarPeriodoTrabajo } from "@/backend/src/actions/trabajos";
import type { PeriodoTrabajoOut } from "@/backend/src/queries/trabajos";
import { periodoTrabajoSchema, periodoTrabajoFieldsEditar } from "../../periodo-trabajo-form-config";
const dt = (v: Date | null) => (v ? String(v).slice(0, 10) : "");
interface Props { data: PeriodoTrabajoOut }
export function EditarPeriodoTrabajoClient({ data }: Props) {
  const p = useParams();
  const modalidad = data.trabajo?.modalidadCobro ?? "horas_variables";
  const esHorasFijas = modalidad === "horas_fijas";
  return <CrudForm title="Editar Período de Trabajo" fields={periodoTrabajoFieldsEditar(modalidad)} schema={periodoTrabajoSchema} defaultValues={{ fechaDesde: dt(data.fechaDesde), fechaHasta: dt(data.fechaHasta), montoACobrar: data.montoACobrar ?? undefined, horasPeriodo: data.horasPeriodo ?? undefined, fechaEstimadaCobro: dt(data.fechaEstimadaCobro), fechaDeCobro: dt(data.fechaDeCobro), nombreTrabajo: data.trabajo?.nombre ?? "" }} onSubmit={async (f) => {
    // Según la modalidad se envía monto u horas (no ambos).
    const payload: Record<string, unknown> = {
      fechaDesde: f.fechaDesde as string,
      fechaHasta: f.fechaHasta as string,
      fechaEstimadaCobro: (f.fechaEstimadaCobro as string) || undefined,
      fechaDeCobro: (f.fechaDeCobro as string) || undefined,
      nombreTrabajo: f.nombreTrabajo as string,
    };
    if (esHorasFijas) {
      payload.horasPeriodo = f.horasPeriodo ? Number(f.horasPeriodo) : undefined;
    } else {
      payload.montoACobrar = f.montoACobrar ? Number(f.montoACobrar) : undefined;
    }
    await actualizarPeriodoTrabajo(Number(p.id), payload);
  }} cancelHref="/cruds/periodos-trabajo" successMessage="Período actualizado correctamente" />;
}
