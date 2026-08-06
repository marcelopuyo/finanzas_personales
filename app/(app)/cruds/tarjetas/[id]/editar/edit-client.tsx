"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarTarjeta } from "@/backend/src/actions/tarjetas";
import type { TarjetaOut } from "@/backend/src/queries/tarjetas";
import { tarjetaSchema, tarjetaFields } from "../../tarjeta-form-config";
interface Props { data: TarjetaOut }
export function EditarTarjetaClient({ data }: Props) {
  const p = useParams();
  return <CrudForm title="Editar Tarjeta" fields={tarjetaFields} schema={tarjetaSchema} defaultValues={{ nombre: data.nombre, banco: data.banco, numero: data.numero, cuenta: data.cuenta?.nombre ?? "" }} onSubmit={async (f) => {
    await actualizarTarjeta(Number(p.id), { nombre: f.nombre as string, banco: f.banco as string, numero: f.numero as string, cuenta: f.cuenta as string });
  }} cancelHref="/cruds/tarjetas" successMessage="Tarjeta actualizada correctamente" />;
}
