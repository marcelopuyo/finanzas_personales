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
  // Con "crear período automático" se exige elegir el trabajo (no el período).
  const periodoValido = data.crearPeriodoAutomatico
    ? data.idTrabajo > 0
    : data.periodoTrabajo > 0;
  const isValid =
    !!data.fecha &&
    horaValida &&
    periodoValido &&
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

      {/* Select de período: incluye la opción "Cargar período automático".
          Al elegirla se pide el TRABAJO (se creará un período de una sola
          jornada); si no, se usa el período existente seleccionado. */}
      <SelectField
        label="Período de trabajo"
        value={
          data.crearPeriodoAutomatico
            ? "auto"
            : data.periodoTrabajo
            ? String(data.periodoTrabajo)
            : ""
        }
        onChange={(v) => {
          if (v === "auto") {
            handleSetData({ periodoTrabajo: 0, crearPeriodoAutomatico: true });
          } else {
            handleSetData({
              periodoTrabajo: v ? Number(v) : 0,
              crearPeriodoAutomatico: false,
            });
          }
        }}
        options={[
          ...options.periodosTrabajo.map((p) => ({
            value: String(p.id),
            label: `${p.trabajo?.nombre ?? "Trabajo"}: ${formatFecha(
              p.fechaDesde
            )} al ${formatFecha(p.fechaHasta)} — ${numberToCurrency(
              p.montoACobrar ?? 0
            )}`,
          })),
          { value: "auto", label: "Cargar período automático" },
        ]}
      />

      {data.crearPeriodoAutomatico && (
        <SelectField
          label="Trabajo"
          value={data.idTrabajo ? String(data.idTrabajo) : ""}
          onChange={(v) => handleSetData({ idTrabajo: Number(v) })}
          options={options.trabajos.map((t) => ({
            value: String(t.id),
            label: t.nombre,
          }))}
        />
      )}

      <SelectField
        label="Cuenta (propina)"
        value={data.cuentaPropina ? String(data.cuentaPropina) : ""}
        onChange={(v) => handleSetData({ cuentaPropina: Number(v) })}
        options={options.cuentas.map((c) => ({
          value: String(c.id),
          label: c.moneda ? `${c.nombre} (${c.moneda.codigoISO})` : c.nombre,
        }))}
      />
    </StepShell>
  );
}
