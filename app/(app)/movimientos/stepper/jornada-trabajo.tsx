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
import {
  decimalToTime,
  numberToCurrency,
  timeToDecimal,
} from "@/lib/utils";

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

  // Trabajo efectivo de la jornada (período seleccionado o trabajo del período
  // automático) para validar que no exista otra jornada con día/horas solapadas.
  const trabajoNombre = data.crearPeriodoAutomatico
    ? options.trabajos.find((t) => t.id === data.idTrabajo)?.nombre
    : options.periodosTrabajo.find((p) => p.id === data.periodoTrabajo)?.trabajo
        ?.nombre;
  const desdeNum = timeToDecimal(data.horaDesde);
  const hastaNum = timeToDecimal(data.horaHasta);
  const jornadaSolapada =
    !!data.fecha && !!trabajoNombre && horaValida
      ? options.jornadas.find(
          (j) =>
            j.trabajo === trabajoNombre &&
            String(j.fechaJornada).slice(0, 10) === data.fecha &&
            j.horaDesde < hastaNum &&
            j.horaHasta > desdeNum
        )
      : undefined;
  const haySolapamiento = !!jornadaSolapada;

  // La fecha de la jornada debe caer dentro del período seleccionado.
  const periodoSeleccionado = data.crearPeriodoAutomatico
    ? undefined
    : options.periodosTrabajo.find((p) => p.id === data.periodoTrabajo);
  const fechaFueraDePeriodo =
    !!data.fecha &&
    !!periodoSeleccionado &&
    (data.fecha < String(periodoSeleccionado.fechaDesde).slice(0, 10) ||
      data.fecha > String(periodoSeleccionado.fechaHasta).slice(0, 10));

  const isValid =
    !!data.fecha &&
    horaValida &&
    periodoValido &&
    !haySolapamiento &&
    !fechaFueraDePeriodo &&
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

      {/* El select de cuenta se muestra SOLO si la propina es mayor que 0
          (si no hay propina no hay nada que depositar). */}
      {requiereCuenta && (
        <SelectField
          label="Cuenta (propina)"
          value={data.cuentaPropina ? String(data.cuentaPropina) : ""}
          onChange={(v) => handleSetData({ cuentaPropina: Number(v) })}
          options={options.cuentas.map((c) => ({
            value: String(c.id),
            label: c.moneda ? `${c.nombre} (${c.moneda.codigoISO})` : c.nombre,
          }))}
        />
      )}

      {/* Aviso de solapamiento: ya existe otra jornada del mismo trabajo en el
          mismo día con horas superpuestas ("Siguiente" queda deshabilitado). */}
      {haySolapamiento && jornadaSolapada && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
          Ya existe una jornada de "{trabajoNombre}" el {formatFecha(data.fecha)}{" "}
          de {decimalToTime(jornadaSolapada.horaDesde)} a{" "}
          {decimalToTime(jornadaSolapada.horaHasta)}. No se pueden superponer
          horas del mismo trabajo.
        </div>
      )}

      {/* Aviso: la fecha de la jornada no cae dentro del período seleccionado
          ("Siguiente" queda deshabilitado). */}
      {fechaFueraDePeriodo && periodoSeleccionado && (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
          La fecha {formatFecha(data.fecha)} no corresponde al período{" "}
          {formatFecha(periodoSeleccionado.fechaDesde)} al{" "}
          {formatFecha(periodoSeleccionado.fechaHasta)} de{" "}
          {periodoSeleccionado.trabajo?.nombre}. Elegí otra fecha o un período
          que la contenga.
        </div>
      )}
    </StepShell>
  );
}
