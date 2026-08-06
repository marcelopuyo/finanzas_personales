"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarPeriodoTarjeta } from "@/backend/src/actions/tarjetas";
import type { PeriodoTarjetaOut } from "@/backend/src/queries/tarjetas";
import { periodoTarjetaSchema, periodoTarjetaFields } from "../../periodo-tarjeta-form-config";
const dt = (v: Date) => String(v).slice(0, 10);
interface Props { data: PeriodoTarjetaOut }
export function EditarPeriodoTarjetaClient({ data }: Props) {
  const p = useParams();
  return <CrudForm title="Editar Período de Tarjeta" fields={periodoTarjetaFields} schema={periodoTarjetaSchema} defaultValues={{ nombre: data.nombre, fechaApertura: dt(data.fechaApertura), fechaCierre: dt(data.fechaCierre), fechaVencimiento: dt(data.fechaVencimiento), tarjeta: data.tarjeta?.nombre ?? "" }} onSubmit={async (f) => {
    await actualizarPeriodoTarjeta(Number(p.id), { nombre: f.nombre as string, fechaApertura: f.fechaApertura as string, fechaCierre: f.fechaCierre as string, fechaVencimiento: f.fechaVencimiento as string, tarjeta: f.tarjeta as string });
  }} cancelHref="/cruds/periodos-tarjeta" successMessage="Período actualizado correctamente" />;
}
