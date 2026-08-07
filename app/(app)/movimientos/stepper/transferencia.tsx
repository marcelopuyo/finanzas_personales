"use client";

import { useMovimientoStepper } from "./stepper-context";
import {
  StepShell,
  NavButtons,
  DateField,
  SelectField,
  NumberField,
} from "./ui";
import { MOTIVOS_TRANSFERENCIA, STEP_CONFIRMACION } from "./types";

export function Transferencia() {
  const { data, handleSetData, navigateTo, options } = useMovimientoStepper();

  const isValid =
    !!data.motivo &&
    data.cuentaOrigen > 0 &&
    data.montoOrigen > 0 &&
    data.cuentaDestino > 0 &&
    data.montoDestino > 0 &&
    data.cuentaOrigen !== data.cuentaDestino;

  const cuentaOptions = options.cuentas.map((c) => ({
    value: String(c.id),
    label: c.nombre,
  }));

  return (
    <StepShell
      title="Por favor ingrese la información de la transferencia:"
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
      <div className="grid gap-4 sm:grid-cols-2">
        <DateField
          label="Fecha"
          value={data.fecha}
          onChange={(v) => handleSetData({ fecha: v })}
        />

        <SelectField
          label="Motivo"
          value={data.motivo}
          onChange={(v) => handleSetData({ motivo: v })}
          options={MOTIVOS_TRANSFERENCIA.map((m) => ({
            value: m,
            label: m,
          }))}
        />
      </div>

      <SelectField
        label="Cuenta origen"
        value={data.cuentaOrigen ? String(data.cuentaOrigen) : ""}
        onChange={(v) => handleSetData({ cuentaOrigen: Number(v) })}
        options={cuentaOptions}
      />

      <NumberField
        label="Monto origen"
        value={data.montoOrigen}
        onChange={(v) =>
          // Mantener en sincronía el monto destino si aún no se editó (patrón original).
          handleSetData({
            montoOrigen: v,
            montoDestino: data.montoDestino === 0 ? v : data.montoDestino,
          })
        }
      />

      <SelectField
        label="Cuenta destino"
        value={data.cuentaDestino ? String(data.cuentaDestino) : ""}
        onChange={(v) => handleSetData({ cuentaDestino: Number(v) })}
        options={cuentaOptions}
      />

      <NumberField
        label="Monto destino"
        value={data.montoDestino}
        onChange={(v) => handleSetData({ montoDestino: v })}
      />

      {data.cuentaOrigen > 0 &&
        data.cuentaDestino > 0 &&
        data.cuentaOrigen === data.cuentaDestino && (
          <p className="text-[12px] text-danger">
            La cuenta origen y destino deben ser distintas.
          </p>
        )}
    </StepShell>
  );
}
