"use client";
import { CrudForm } from "@/components/crud/CrudForm";
import { crearCuenta } from "@/backend/src/actions/maestros";
import { cuentaSchema, cuentaFields } from "../cuenta-form-config";
export default function NuevaCuentaPage() {
  return <CrudForm title="Nueva Cuenta" fields={cuentaFields} schema={cuentaSchema} onSubmit={async (d) => {
    await crearCuenta({ nombre: d.nombre as string, saldo: Number(d.saldo), tipo: d.tipo as string, moneda: d.moneda as string });
  }} cancelHref="/cruds/cuentas" successMessage="Cuenta creada correctamente" />;
}
