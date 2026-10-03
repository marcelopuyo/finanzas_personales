"use client";

import { useMovimientoStepper } from "./stepper-context";
import {
  StepShellFintech,
  HeroeFintech,
  BotonPrincipal,
  DateField,
  SelectField,
  NumberField,
  formatFecha,
} from "./ui";
import { numberToCurrency, simboloMoneda } from "@/lib/utils";
import { STEP_CONFIRMACION } from "./types";

export function PagoGasto() {
  const { data, handleSetData, navigateTo, options } = useMovimientoStepper();

  const isValid =
    !!data.idGasto && data.cuentaOrigen > 0 && data.montoOrigen > 0;

  // Moneda de la cuenta elegida: da el símbolo del héroe (monto a pagar).
  const isoCuenta =
    options.cuentas.find((c) => c.id === data.cuentaOrigen)?.moneda
      ?.codigoISO ?? "";

  return (
    <StepShellFintech
      titulo="Pago de gasto"
      step={2}
      total={3}
      heroe={
        <HeroeFintech
          etiqueta={`Monto a pagar${isoCuenta ? ` · ${isoCuenta}` : ""}`}
        >
          <NumberField
            hero
            heroPrefix={isoCuenta ? simboloMoneda(isoCuenta) : ""}
            label="Monto a pagar"
            value={data.montoOrigen}
            onChange={(v) => handleSetData({ montoOrigen: v })}
          />
        </HeroeFintech>
      }
      footer={
        <BotonPrincipal
          onClick={() => navigateTo(STEP_CONFIRMACION)}
          disabled={!isValid}
        >
          Siguiente
        </BotonPrincipal>
      }
    >
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
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
      </div>
    </StepShellFintech>
  );
}
