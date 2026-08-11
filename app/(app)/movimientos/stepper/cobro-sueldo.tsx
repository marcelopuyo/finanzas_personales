"use client";

import { useMovimientoStepper } from "./stepper-context";
import { StepShell, NavButtons, DateField, SelectField, NumberField, formatFecha } from "./ui";
import { numberToCurrency } from "@/lib/utils";
import { STEP_CONFIRMACION } from "./types";

export function CobroSueldo() {
  const { data, handleSetData, navigateTo, options } = useMovimientoStepper();

  const isValid =
    data.periodoTrabajo > 0 && data.cuentaOrigen > 0 && data.montoOrigen > 0;

  return (
    <StepShell
      title="Por favor ingrese la información del cobro de sueldo:"
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
      <DateField
        label="Fecha"
        value={data.fecha}
        onChange={(v) => handleSetData({ fecha: v })}
      />

      <SelectField
        label="Período de trabajo"
        value={data.periodoTrabajo ? String(data.periodoTrabajo) : ""}
        onChange={(v) => {
          const id = Number(v);
          const pt = options.periodosTrabajo.find((p) => p.id === id);
          // Al elegir el período se precarga el monto a cobrar (como el original).
          handleSetData({
            periodoTrabajo: id,
            montoOrigen: pt?.montoACobrar ?? 0,
          });
        }}
        options={options.periodosTrabajo.map((p) => ({
          value: String(p.id),
          label: `${p.trabajo?.nombre ?? "Trabajo"}: ${formatFecha(p.fechaDesde)} al ${formatFecha(p.fechaHasta)} — ${numberToCurrency(p.montoACobrar ?? 0)}`,
        }))}
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
    </StepShell>
  );
}
