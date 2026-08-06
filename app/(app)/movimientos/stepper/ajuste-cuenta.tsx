"use client";

import { useMovimientoStepper } from "./stepper-context";
import { StepShell, NavButtons, DateField, SelectField, NumberField } from "./ui";

export function AjusteCuenta() {
  const { data, handleSetData, navigateTo, options } = useMovimientoStepper();

  const isValid = data.cuentaOrigen > 0 && data.montoOrigen !== 0;

  return (
    <StepShell
      title="Por favor ingrese la información del ajuste:"
      step={2}
      total={3}
      footer={
        <NavButtons
          onBack={() => navigateTo(0)}
          onNext={() => navigateTo(7)}
          nextDisabled={!isValid}
        />
      }
    >
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
          label: c.nombre,
        }))}
      />

      <NumberField
        label="Monto (positivo: ingreso / negativo: egreso)"
        value={data.montoOrigen}
        onChange={(v) => handleSetData({ montoOrigen: v })}
        allowNegative
      />
    </StepShell>
  );
}
