"use client";

import { useMovimientoStepper } from "./stepper-context";
import { StepShell, NavButtons } from "./ui";
import { CONCEPTO_STEP, type MovimientoConcepto } from "./types";
import { cn } from "@/lib/utils";

const OPCIONES: { value: MovimientoConcepto; label: string; desc: string }[] = [
  { value: "CobroSueldo", label: "Cobro Sueldo", desc: "Registrar el cobro de un sueldo" },
  { value: "PagoPrestamo", label: "Pago Préstamo", desc: "Abonar cuota de un préstamo" },
  { value: "AjusteCuenta", label: "Ajuste Cuenta", desc: "Corregir el saldo de una cuenta" },
  { value: "PagoGasto", label: "Pago Gasto", desc: "Pagar un gasto pendiente" },
  { value: "GastoDirecto", label: "Gasto Directo", desc: "Crear y pagar un gasto en un solo paso" },
  { value: "Transferencia", label: "Transferencia", desc: "Mover dinero entre cuentas" },
];

export function Selector() {
  const { data, seleccionarConcepto, navigateTo } = useMovimientoStepper();

  return (
    <StepShell
      title="Seleccione el tipo de movimiento a realizar"
      step={1}
      total={3}
      footer={
        <NavButtons
          onBack={() => navigateTo(0)}
          onNext={() => {
            if (data.concepto) navigateTo(CONCEPTO_STEP[data.concepto]);
          }}
          nextDisabled={!data.concepto}
        />
      }
    >
      <div className="space-y-2">
        {OPCIONES.map((o) => {
          const active = data.concepto === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => seleccionarConcepto(o.value)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-muted"
              )}
            >
              <div>
                <p className="text-[13px] font-medium text-header">{o.label}</p>
                <p className="text-[12px] text-subtitle">{o.desc}</p>
              </div>
              <span
                className={cn(
                  "h-3.5 w-3.5 shrink-0 rounded-full border-2",
                  active ? "border-primary bg-primary" : "border-subtitle"
                )}
              />
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}
