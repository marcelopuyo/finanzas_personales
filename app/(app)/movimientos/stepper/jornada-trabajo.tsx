"use client";

import { useMovimientoStepper } from "./stepper-context";
import {
  StepShell,
  NavButtons,
  DateField,
  TimeField,
  NumberField,
  SelectField,
  formatFecha,
} from "./ui";
import { STEP_CONFIRMACION } from "./types";
import { numberToCurrency } from "@/lib/utils";

/**
 * Paso del wizard: cargar una nueva jornada de trabajo.
 * Mismos campos que el CRUD de jornadas (sin "monto jornada", se calcula en el
 * servidor) + un select de cuenta. Si el usuario carga propina > 0, se deposita
 * en la cuenta seleccionada (la propina nunca suma a "Períodos a Cobrar/Actuales").
 */
export function JornadaTrabajo() {
  const { data, handleSetData, navigateTo, options } = useMovimientoStepper();

  const horaValida =
    !!data.horaDesde && !!data.horaHasta && data.horaDesde < data.horaHasta;
  const requiereCuenta = data.montoPropina > 0;
  const isValid =
    !!data.fecha &&
    horaValida &&
    data.periodoTrabajo > 0 &&
    (!requiereCuenta || data.cuentaPropina > 0);

  return (
    <StepShell
      title="Por favor ingrese la información de la jornada de trabajo:"
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

      <TimeField
        label="Hora Desde"
        value={data.horaDesde}
        onChange={(v) => handleSetData({ horaDesde: v })}
      />

      <TimeField
        label="Hora Hasta"
        value={data.horaHasta}
        onChange={(v) => handleSetData({ horaHasta: v })}
      />

      <NumberField
        label="Monto Propina"
        value={data.montoPropina}
        onChange={(v) => handleSetData({ montoPropina: v })}
      />

      <SelectField
        label="Período de trabajo"
        value={data.periodoTrabajo ? String(data.periodoTrabajo) : ""}
        onChange={(v) => handleSetData({ periodoTrabajo: Number(v) })}
        options={options.periodosTrabajo.map((p) => ({
          value: String(p.id),
          label: `${p.trabajo?.nombre ?? "Trabajo"}: ${formatFecha(
            p.fechaDesde
          )} al ${formatFecha(p.fechaHasta)} — ${numberToCurrency(
            p.montoACobrar ?? 0
          )}`,
        }))}
      />

      <SelectField
        label="Cuenta (propina)"
        value={data.cuentaPropina ? String(data.cuentaPropina) : ""}
        onChange={(v) => handleSetData({ cuentaPropina: Number(v) })}
        options={options.cuentas.map((c) => ({
          value: String(c.id),
          label: c.nombre,
        }))}
      />
    </StepShell>
  );
}
