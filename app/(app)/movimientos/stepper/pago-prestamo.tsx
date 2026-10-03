"use client";

import { useMovimientoStepper } from "./stepper-context";
import {
  StepShellFintech,
  HeroeFintech,
  BotonPrincipal,
  DateField,
  SelectField,
  NumberField,
} from "./ui";
import { simboloMoneda } from "@/lib/utils";
import { prestamoLabel } from "@/lib/prestamos";
import { STEP_CONFIRMACION } from "./types";

export function PagoPrestamo() {
  const { data, handleSetData, navigateTo, options } = useMovimientoStepper();

  const isValid =
    !!data.idPrestamo && data.cuentaOrigen > 0 && data.montoOrigen > 0;

  // Moneda de la cuenta elegida: da el símbolo del héroe (monto a pagar).
  const isoCuenta =
    options.cuentas.find((c) => c.id === data.cuentaOrigen)?.moneda
      ?.codigoISO ?? "";

  return (
    <StepShellFintech
      titulo="Pago de préstamo"
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
        {/* Préstamo a pagar en primer lugar: al seleccionarlo se autocompleta el
            monto con el saldo pendiente del préstamo elegido. */}
        <SelectField
          label="Préstamo a pagar"
          value={data.idPrestamo}
          onChange={(id) => {
            const prestamo = options.prestamos.find((p) => p.id === id);
            handleSetData({
              idPrestamo: id,
              // Autocompleta el monto a pagar con el saldo del préstamo. Si se
              // deselecciona, se conserva el monto ya cargado.
              montoOrigen: prestamo ? prestamo.saldo : data.montoOrigen,
            });
          }}
          placeholder="Seleccionar préstamo..."
          options={options.prestamos.map((p) => ({
            value: p.id,
            label: prestamoLabel(p),
          }))}
        />

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
      </div>
    </StepShellFintech>
  );
}
