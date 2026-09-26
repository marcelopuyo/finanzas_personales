"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMovimientoStepper } from "./stepper-context";
import { StepShell, NavButtons, DateField, SelectField, NumberField } from "./ui";
import { STEP_CONFIRMACION, type MovimientoData } from "./types";
import { numberToCurrency } from "@/lib/utils";
import { crearDictadoAjuste } from "./dictado-ajuste";
import { aplicarDictadoSimple, escribirEnPantalla } from "./dictado-comun";
import { useAliasDeCampo } from "@/components/voz/voz-provider";
import {
  useRegistrarPantallaDictable,
  type PantallaDictable,
  type ValoresPantalla,
} from "@/components/voz/dictado-pantalla";

export function AjusteCuenta() {
  const { data, handleSetData, navigateTo, options } = useMovimientoStepper();

  const isValid = data.cuentaOrigen > 0 && data.montoOrigen !== 0;

  // Cuenta seleccionada y su moneda: el monto del ajuste se aplica DIRECTAMENTE
  // al saldo de esa cuenta (backend: `cuenta.saldo += data.monto`), así que el
  // feedback se muestra en la moneda de la cuenta.
  const cuenta = options.cuentas.find((c) => c.id === data.cuentaOrigen);
  const iso = cuenta?.moneda?.codigoISO ?? "ARS";
  const saldoActual = cuenta?.saldo ?? 0;
  const saldoAjustado = saldoActual + (data.montoOrigen || 0);

  // ── Dictado por voz (plan de voz §16.2) ─────────────────────────────────
  // Es el **único flujo con monto negativo** (hueco 2): decir *"menos 500"* escribe
  // −500 (egreso) y *"ajustá 500"* deja +500 (ingreso). El campo del wizard ya
  // admite el signo (`allowNegative`) y el backend hace `saldo += monto`.
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
    const base = crearDictadoAjuste(options);
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
      title="Por favor ingrese la información del ajuste:"
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
        label="Monto (positivo: ingreso / negativo: egreso)"
        value={data.montoOrigen}
        onChange={(v) => handleSetData({ montoOrigen: v })}
        allowNegative
      />

      {/* Feedback del ajuste: muestra el saldo actual de la cuenta y el saldo
          RESULTANTE tras aplicar el monto ingresado, para verificar que el
          importe es correcto. Se muestra al elegir la cuenta (en su moneda). */}
      {cuenta && (
        <div className="rounded-lg border border-border bg-muted px-3 py-2.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-subtitle">Saldo actual</span>
            <span className="font-medium text-card-foreground">
              {numberToCurrency(saldoActual, iso)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5 text-[13px]">
            <span className="text-subtitle">Saldo ajustado</span>
            <span className="font-semibold tracking-tight text-value">
              {numberToCurrency(saldoAjustado, iso)}
            </span>
          </div>
        </div>
      )}
    </StepShell>
  );
}
