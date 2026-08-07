"use client";

import { useMovimientoStepper } from "./stepper-context";
import {
  StepShell,
  NavButtons,
  DateField,
  SelectField,
  NumberField,
  formatFecha,
} from "./ui";
import { numberToCurrency } from "@/lib/utils";
import { STEP_CONFIRMACION } from "./types";

export function PagoGasto() {
  const { data, handleSetData, navigateTo, options } = useMovimientoStepper();

  const isValid =
    !!data.idGasto && data.cuentaOrigen > 0 && data.montoOrigen > 0;

  return (
    <StepShell
      title="Por favor ingrese la información del pago de gasto:"
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
        label="Cuenta"
        value={data.cuentaOrigen ? String(data.cuentaOrigen) : ""}
        onChange={(v) => handleSetData({ cuentaOrigen: Number(v) })}
        options={options.cuentas.map((c) => ({
          value: String(c.id),
          label: c.nombre,
        }))}
      />

      <NumberField
        label="Monto a pagar"
        value={data.montoOrigen}
        onChange={(v) => handleSetData({ montoOrigen: v })}
      />

      <SelectField
        label="Gasto a pagar"
        value={data.idGasto}
        onChange={(v) => handleSetData({ idGasto: v })}
        placeholder="Seleccionar gasto..."
        options={options.gastos.map((g) => ({
          value: g.id,
          label: `${g.descripcion ?? "Gasto"} — Monto ${numberToCurrency(g.monto)} · Saldo ${numberToCurrency(g.saldo)} · Vence ${formatFecha(g.fechaVencimiento)} (${g.categoria?.nombre ?? "Sin categoría"})`,
        }))}
      />
    </StepShell>
  );
}
