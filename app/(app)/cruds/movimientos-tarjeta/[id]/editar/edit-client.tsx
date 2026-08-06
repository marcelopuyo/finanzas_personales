"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarMovimientoTarjeta } from "@/backend/src/actions/tarjetas";
import type { MovimientoTarjetaOut } from "@/backend/src/queries/tarjetas";
import { movimientoTarjetaSchema, movimientoTarjetaFields } from "../../movimiento-tarjeta-form-config";
const dt = (v: Date) => String(v).slice(0, 10);
interface Props { data: MovimientoTarjetaOut }
export function EditarMovimientoTarjetaClient({ data }: Props) {
  const p = useParams();
  return <CrudForm title="Editar Movimiento de Tarjeta" fields={movimientoTarjetaFields} schema={movimientoTarjetaSchema} defaultValues={{ detalle: data.detalle ?? "", fecha: dt(data.fecha), monto: data.monto, cuotas: data.cuotas, persona: data.persona?.nombre ?? "", tarjeta: data.tarjeta?.nombre ?? "", periodo: data.periodo?.nombre ?? "" }} onSubmit={async (f) => {
    await actualizarMovimientoTarjeta(String(p.id), { detalle: (f.detalle as string) || undefined, fecha: f.fecha as string, monto: Number(f.monto), cuotas: Number(f.cuotas), persona: f.persona as string, tarjeta: f.tarjeta as string, periodo: f.periodo as string });
  }} cancelHref="/cruds/movimientos-tarjeta" successMessage="Movimiento actualizado correctamente" />;
}
