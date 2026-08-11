"use client";

import { useMovimientoStepper } from "./stepper-context";
import {
  StepShell,
  NavButtons,
  DateField,
  SelectField,
  NumberField,
  AutoCompleteField,
} from "./ui";
import { buscarDescripcionesGastoAction } from "../buscar-descripciones";
import { STEP_CONFIRMACION } from "./types";

export function GastoDirecto() {
  const { data, handleSetData, navigateTo, options } = useMovimientoStepper();

  const isValid =
    data.descripcion.trim().length > 0 &&
    data.cuentaOrigen > 0 &&
    data.montoOrigen > 0 &&
    data.idCategoriaGasto > 0;

  return (
    <StepShell
      title="Por favor ingrese la información del gasto directo:"
      step={2}
      total={3}
      footer={
        <NavButtons
          onBack={() => navigateTo(0)}
          onNext={() => navigateTo(STEP_CONFIRMACION)}
          nextDisabled={!isValid}
        />
      }
    >
      <AutoCompleteField
        label="Descripción"
        value={data.descripcion}
        onChange={(v) => handleSetData({ descripcion: v })}
        buscar={buscarDescripcionesGastoAction}
        placeholder="Ej: Supermercado"
      />

      <DateField
        label="Fecha"
        value={data.fecha}
        onChange={(v) => handleSetData({ fecha: v })}
      />

      <SelectField
        label="Cuenta"
        value={data.cuentaOrigen ? String(data.cuentaOrigen) : ""}
        onChange={(v) => handleSetData({ cuentaOrigen: Number(v) })}
        options={options.cuentas.map((c) => ({
          value: String(c.id),
          label: c.moneda ? `${c.nombre} (${c.moneda.codigoISO})` : c.nombre,
        }))}
      />

      <NumberField
        label="Monto"
        value={data.montoOrigen}
        onChange={(v) => handleSetData({ montoOrigen: v })}
      />

      <SelectField
        label="Categoría de gasto"
        value={data.idCategoriaGasto ? String(data.idCategoriaGasto) : ""}
        onChange={(v) => handleSetData({ idCategoriaGasto: Number(v) })}
        options={options.categoriasGasto.map((c) => ({
          value: String(c.id),
          label: c.nombre,
        }))}
      />
    </StepShell>
  );
}
