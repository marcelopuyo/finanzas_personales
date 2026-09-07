"use client";
import { useParams } from "next/navigation";
import { CrudForm } from "@/components/crud/CrudForm";
import { actualizarCuenta } from "@/backend/src/actions/maestros";
import type { CuentaOut } from "@/backend/src/queries/maestros";
import { cuentaSchema, cuentaFields } from "../../cuenta-form-config";
interface Props {
  data: CuentaOut;
  /** Origen de navegación (?origen=...). Si es "dashboard", Cancelar / volver
      regresan a la grilla conservando el origen (mantiene el botón volver). */
  origen?: string;
}
export function EditarCuentaClient({ data, origen }: Props) {
  const p = useParams();
  const destino =
    origen === "dashboard" ? "/cruds/cuentas?origen=dashboard" : "/cruds/cuentas";
  return <CrudForm title="Editar Cuenta" fields={cuentaFields} schema={cuentaSchema} defaultValues={{ nombre: data.nombre, saldo: data.saldo, tipo: data.tipo?.nombre ?? "", moneda: data.moneda?.nombre ?? "", incluirEnBalance: String(data.incluirEnBalance) }} onSubmit={async (f) => {
    await actualizarCuenta(Number(p.id), { nombre: f.nombre as string, saldo: Number(f.saldo), tipo: f.tipo as string, moneda: f.moneda as string, incluirEnBalance: f.incluirEnBalance === "true" });
  }} cancelHref={destino} successHref={destino} successMessage="Cuenta actualizada correctamente" />;
}
