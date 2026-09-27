"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
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
import { STEP_CONFIRMACION, type MovimientoData } from "./types";
import { decimalToTime, timeToDecimal } from "@/lib/utils";
import { useAliasDeCampo } from "@/components/voz/voz-provider";
import {
  useRegistrarPantallaDictable,
  type PantallaDictable,
  type ValoresPantalla,
} from "@/components/voz/dictado-pantalla";
import { aplicarDictadoSimple, escribirEnPantalla } from "./dictado-comun";
import { crearDictadoJornada } from "./dictado-trabajo";

/**
 * Paso del wizard: cargar una nueva jornada de trabajo.
 * Mismos campos que el CRUD de jornadas (sin "monto jornada", se calcula en el
 * servidor) + un select de cuenta. Si el usuario carga propina > 0, se deposita
 * en la cuenta seleccionada (la propina nunca suma a "Por cobrar/Actuales").
 */
export function JornadaTrabajo() {
  const { data, handleSetData, navigateTo, options } = useMovimientoStepper();

  /**
   * Solo trabajos de modalidad `horas_variables` admiten jornadas.
   *
   * ⚠️ **Memoizado a propósito**: `filter` devuelve un array **nuevo** en cada render
   * y alimenta las dependencias de la config de voz ⇒ sin esto la pantalla se
   * **re-registraba** ante el FAB en cada render y el wizard entraba en un bucle
   * ("Maximum update depth exceeded", visto en el celular el 2026-09-27).
   */
  const trabajosHoras = useMemo(
    () =>
      options.trabajos.filter(
        (t) => (t.modalidadCobro ?? "horas_variables") === "horas_variables"
      ),
    [options.trabajos]
  );

  /**
   * **Dictado por voz (2026-09-27)**: la pantalla se declara dictable ante el FAB 🎤
   * ("trabajé en publix el 25 de 9 a 17", "cargá una jornada de 13 a 17 con 100 de
   * propina en billetera"). Usa las piezas compartidas de `dictado-comun.ts`
   * (regla 7 + snapshot), igual que transferencia y ajuste.
   */
  const opcionesCuentaVoz = useMemo(
    () => options.cuentas.map((c) => ({ value: String(c.id), label: c.nombre })),
    [options.cuentas]
  );
  const aliasCuenta = useAliasDeCampo("cuenta", opcionesCuentaVoz);
  const configVoz = useMemo(() => {
    const base = crearDictadoJornada({
      trabajos: trabajosHoras.map((t) => ({ id: t.id, nombre: t.nombre })),
      cuentas: options.cuentas.map((c) => ({ id: c.id, nombre: c.nombre })),
    });
    return {
      ...base,
      campos: base.campos.map((campo) =>
        campo.campo === "cuentaPropina" ? { ...campo, alias: aliasCuenta } : campo
      ),
    };
  }, [trabajosHoras, options.cuentas, aliasCuenta]);
  // Los datos frescos sin recrear la pantalla a cada tecla (si no, el FAB
  // re-registraría la pantalla en cada cambio de un campo).
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);
  const escribirVoz = useCallback(
    (valores: ValoresPantalla) => {
      handleSetData(valores as unknown as Partial<MovimientoData>);
    },
    [handleSetData]
  );
  const pantallaVoz = useMemo<PantallaDictable>(
    () => ({
      config: configVoz,
      aplicar: (resultado) =>
        aplicarDictadoSimple(
          resultado,
          configVoz,
          dataRef.current as unknown as Record<string, unknown>,
          escribirVoz
        ),
      escribir: (valores) =>
        escribirEnPantalla(
          valores,
          dataRef.current as unknown as Record<string, unknown>,
          escribirVoz
        ),
    }),
    [configVoz, escribirVoz]
  );
  useRegistrarPantallaDictable(pantallaVoz);

  const horaValida =
    !!data.horaDesde && !!data.horaHasta && data.horaDesde < data.horaHasta;
  const requiereCuenta = data.montoPropina > 0;
  // El **trabajo** es el único vínculo: la jornada queda **pendiente de
  // liquidar** (sin período) y se cobra después con la liquidación.
  const trabajoValido = data.idTrabajo > 0;

  const trabajoNombre = trabajosHoras.find(
    (t) => t.id === data.idTrabajo
  )?.nombre;
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

  const isValid =
    !!data.fecha &&
    horaValida &&
    trabajoValido &&
    !haySolapamiento &&
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
      {!trabajosHoras.length && (
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-[13px] text-subtitle">
          No tenés trabajos con modalidad por hora (horas variables). Las
          jornadas solo se cargan en ese tipo de trabajo.
        </div>
      )}

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

      {/* El **trabajo** es el único vínculo de la jornada: no hay período que
          elegir (la liquidación nace al cobrar). */}
      <SelectField
        label="Trabajo"
        value={data.idTrabajo ? String(data.idTrabajo) : ""}
        onChange={(v) => handleSetData({ idTrabajo: Number(v) })}
        options={trabajosHoras.map((t) => ({
          value: String(t.id),
          label: t.nombre,
        }))}
      />

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
          Ya existe una jornada de &quot;{trabajoNombre}&quot; el {formatFecha(data.fecha)}{" "}
          de {decimalToTime(jornadaSolapada.horaDesde)} a{" "}
          {decimalToTime(jornadaSolapada.horaHasta)}. No se pueden superponer
          horas del mismo trabajo.
        </div>
      )}

    </StepShell>
  );
}
