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

export function PagoPrestamo() {
  const { data, handleSetData, navigateTo, options } = useMovimientoStepper();

  const isValid =
    !!data.idPrestamo && data.cuentaOrigen > 0 && data.montoOrigen > 0;

  return (
    <StepShell
      title="Por favor ingrese la información del pago de préstamo:"
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
          label: c.moneda ? `${c.nombre} (${c.moneda.codigoISO})` : c.nombre,
        }))}
      />

      <NumberField
        label="Monto a pagar"
        value={data.montoOrigen}
        onChange={(v) => handleSetData({ montoOrigen: v })}
      />

      <SelectField
        label="Préstamo a pagar"
        value={data.idPrestamo}
        onChange={(v) => handleSetData({ idPrestamo: v })}
        placeholder="Seleccionar préstamo..."
        options={options.prestamos.map((p) => ({
          value: p.id,
          label: `${p.detalle ?? "Préstamo"} — Monto ${numberToCurrency(p.monto)} · Saldo ${numberToCurrency(p.saldo)} · ${formatFecha(p.fecha)} (${p.personaOrigen?.nombre ?? "—"} → ${p.personaDestino?.nombre ?? "—"})`,
        }))}
      />
    </StepShell>
  );
}
