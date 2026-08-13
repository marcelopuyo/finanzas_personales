"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarCuenta } from "@/backend/src/actions/maestros";
import type { CuentaOut } from "@/backend/src/queries/maestros";
import { cuentaSchema, cuentaFields } from "../../cuenta-form-config";
interface Props { data: CuentaOut }
export function EditarCuentaClient({ data }: Props) {
  const p = useParams();
  return <CrudForm title="Editar Cuenta" fields={cuentaFields} schema={cuentaSchema} defaultValues={{ nombre: data.nombre, saldo: data.saldo, tipo: data.tipo?.nombre ?? "", moneda: data.moneda?.nombre ?? "", incluirEnBalance: String(data.incluirEnBalance) }} onSubmit={async (f) => {
    await actualizarCuenta(Number(p.id), { nombre: f.nombre as string, saldo: Number(f.saldo), tipo: f.tipo as string, moneda: f.moneda as string, incluirEnBalance: f.incluirEnBalance === "true" });
  }} cancelHref="/cruds/cuentas" successMessage="Cuenta actualizada correctamente" />;
}
