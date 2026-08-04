"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarCotizacion } from "@/backend/src/actions/maestros";
import type { CotizacionOut } from "@/backend/src/queries/maestros";
import { cotizacionSchema, cotizacionFields } from "../../cotizacion-form-config";
const dt = (v: Date) => String(v).slice(0, 10);
interface Props { data: CotizacionOut }
export function EditarCotizacionClient({ data }: Props) {
  const p = useParams();
  return <CrudForm title="Editar Cotización" fields={cotizacionFields} schema={cotizacionSchema} defaultValues={{ fechaInicial: dt(data.fechaInicial), fechaFinal: dt(data.fechaFinal), cotizacion: data.cotizacion, moneda: data.moneda?.nombre ?? "" }} onSubmit={async (f) => {
    await actualizarCotizacion(Number(p.id), { fechaInicial: f.fechaInicial as string, fechaFinal: f.fechaFinal as string, cotizacion: Number(f.cotizacion), moneda: f.moneda as string });
  }} cancelHref="/cruds/cotizaciones" successMessage="Cotización actualizada correctamente" />;
}
