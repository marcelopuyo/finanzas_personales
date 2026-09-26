"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMovimientoStepper } from "./stepper-context";
import {
  StepShell,
  NavButtons,
  DateField,
  SelectField,
  NumberField,
} from "./ui";
import { MOTIVOS_TRANSFERENCIA, STEP_CONFIRMACION, type MovimientoData } from "./types";
import { convertirMontoParaUI } from "@/backend/src/actions/cotizaciones";
import { crearDictadoTransferencia } from "./dictado-transferencia";
import { aplicarDictadoSimple, escribirEnPantalla } from "./dictado-comun";
import { useAliasDeCampo } from "@/components/voz/voz-provider";
import {
  useRegistrarPantallaDictable,
  type PantallaDictable,
  type ValoresPantalla,
} from "@/components/voz/dictado-pantalla";

export function Transferencia() {
  const { data, handleSetData, navigateTo, options } = useMovimientoStepper();
  // El destino se autocomputa hasta que el usuario lo edita manualmente.
  const [destinoEditado, setDestinoEditado] = useState(false);

  const isValid =
    !!data.motivo &&
    data.cuentaOrigen > 0 &&
    data.montoOrigen > 0 &&
    data.cuentaDestino > 0 &&
    data.montoDestino > 0 &&
    data.cuentaOrigen !== data.cuentaDestino;

  const cuentaOptions = options.cuentas.map((c) => ({
    value: String(c.id),
    label: c.moneda
      ? `${c.nombre} (${c.moneda.codigoISO})`
      : c.nombre,
  }));

  // Monedas de las cuentas seleccionadas (para autocomputar entre monedas).
  const cuentaOrigen = options.cuentas.find((c) => c.id === data.cuentaOrigen);
  const cuentaDestino = options.cuentas.find((c) => c.id === data.cuentaDestino);
  const monedaOrigenISO = cuentaOrigen?.moneda?.codigoISO ?? "ARS";
  const monedaDestinoISO = cuentaDestino?.moneda?.codigoISO ?? "ARS";
  const mismaMoneda = monedaOrigenISO === monedaDestinoISO;

  // Si el usuario cambia de cuentas, se vuelve a sincronizar el destino: el
  // reset se hace en los handlers de los dos selects (antes vivía en un efecto,
  // que provocaba un render en cascada).

  // Autocomputa el monto destino según las monedas de las cuentas mientras el
  // usuario no haya editado el destino manualmente (el destino sigue siendo
  // editable): misma moneda → mismo monto; monedas distintas → cotizado.
  useEffect(() => {
    if (
      destinoEditado ||
      data.montoOrigen <= 0 ||
      data.cuentaOrigen <= 0 ||
      data.cuentaDestino <= 0 ||
      !cuentaOrigen ||
      !cuentaDestino
    ) {
      return;
    }
    if (mismaMoneda) {
      handleSetData({ montoDestino: data.montoOrigen });
      return;
    }
    let cancelado = false;
    convertirMontoParaUI({
      monto: data.montoOrigen,
      origenCodigoISO: monedaOrigenISO,
      destinoCodigoISO: monedaDestinoISO,
    })
      .then((r) => {
        if (!cancelado) handleSetData({ montoDestino: r.monto });
      })
      .catch(() => {
        /* deja el destino sin tocar */
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data.montoOrigen,
    data.cuentaOrigen,
    data.cuentaDestino,
    mismaMoneda,
    destinoEditado,
  ]);

  // ── Dictado por voz (plan de voz §16.2) ─────────────────────────────────
  // La pantalla se declara dictable ante el FAB 🎤: `config` = los campos con el
  // vocabulario de **cuentas** ya fusionado (sistema + aprendido); `aplicar` /
  // `escribir` escriben en el wizard con la regla 7 (lo implícito no pisa).
  // ⚠️ `montoDestino` **no** está en la config a propósito: lo autocompleta el
  // efecto de arriba (misma moneda ⇒ mismo monto; distinta ⇒ cotizado).
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const opcionesCuenta = useMemo(
    () => options.cuentas.map((c) => ({ value: String(c.id), label: c.nombre })),
    [options.cuentas]
  );
  const aliasCuenta = useAliasDeCampo("cuenta", opcionesCuenta);

  const config = useMemo(() => {
    const base = crearDictadoTransferencia(options);
    return {
      ...base,
      campos: base.campos.map((campo) =>
        campo.catalogo === "cuenta" ? { ...campo, alias: aliasCuenta } : campo
      ),
    };
  }, [options, aliasCuenta]);

  const escribir = useCallback(
    (valores: ValoresPantalla) =>
      handleSetData(valores as unknown as Partial<MovimientoData>),
    [handleSetData]
  );

  const pantalla = useMemo<PantallaDictable>(
    () => ({
      config,
      aplicar: async (resultado) =>
        aplicarDictadoSimple(
          resultado,
          config,
          dataRef.current as unknown as Record<string, unknown>,
          escribir
        ),
      escribir: (valores) =>
        escribirEnPantalla(
          valores,
          dataRef.current as unknown as Record<string, unknown>,
          escribir
        ),
    }),
    [config, escribir]
  );

  useRegistrarPantallaDictable(pantalla);

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
        onChange={(v) => {
          setDestinoEditado(false);
          handleSetData({ cuentaOrigen: Number(v) });
        }}
        options={cuentaOptions}
      />

      <NumberField
        label={`Monto origen (${monedaOrigenISO})`}
        value={data.montoOrigen}
        onChange={(v) => handleSetData({ montoOrigen: v })}
      />

      <SelectField
        label="Cuenta destino"
        value={data.cuentaDestino ? String(data.cuentaDestino) : ""}
        onChange={(v) => {
          setDestinoEditado(false);
          handleSetData({ cuentaDestino: Number(v) });
        }}
        options={cuentaOptions}
      />

      <NumberField
        label={`Monto destino (${monedaDestinoISO})`}
        value={data.montoDestino}
        onChange={(v) => {
          setDestinoEditado(true);
          handleSetData({ montoDestino: v });
        }}
      />

      {!mismaMoneda && cuentaOrigen && cuentaDestino && (
        <p className="text-[12px] text-subtitle">
          Las cuentas tienen monedas distintas ({monedaOrigenISO} →{" "}
          {monedaDestinoISO}). El monto destino se autocomputa con la
          cotización del día y podés editarlo.
        </p>
      )}

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
