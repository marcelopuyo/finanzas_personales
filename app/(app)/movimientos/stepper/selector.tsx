"use client";

import { useMovimientoStepper } from "./stepper-context";
import { StepShellFintech, BotonPrincipal } from "./ui";
import { CONCEPTO_STEP, type MovimientoConcepto } from "./types";
import { cn } from "@/lib/utils";

const OPCIONES: { value: MovimientoConcepto; label: string; desc: string }[] = [
  { value: "CobrarTrabajo", label: "Cobrar trabajo", desc: "Registrar el cobro de un trabajo (liquidación)" },
  { value: "PagoPrestamo", label: "Pago Préstamo", desc: "Abonar cuota de un préstamo" },
  { value: "AjusteCuenta", label: "Ajuste Cuenta", desc: "Corregir el saldo de una cuenta" },
  // PagoGasto oculto por pedido del usuario (la lógica sigue disponible en
  // CONCEPTO_STEP/confirmacion si se quiere reactivar).
  // { value: "PagoGasto", label: "Pago Gasto", desc: "Pagar un gasto pendiente" },
  { value: "GastoDirecto", label: "Gasto", desc: "Cargar un gasto" },
  { value: "Transferencia", label: "Transferencia", desc: "Mover dinero entre cuentas" },
  { value: "JornadaTrabajo", label: "Jornada trabajo", desc: "Cargar una nueva jornada de trabajo" },
  { value: "CargarTarea", label: "Cargar tarea", desc: "Registrar una tarea (trabajo por tarea)" },
];

export function Selector() {
  const { data, seleccionarConcepto, navigateTo } = useMovimientoStepper();

  return (
    <StepShellFintech
      titulo="Movimiento"
      step={1}
      total={3}
      heroe={null}
      footer={
        <BotonPrincipal
          onClick={() => {
            if (data.concepto) navigateTo(CONCEPTO_STEP[data.concepto]);
          }}
          disabled={!data.concepto}
        >
          Siguiente
        </BotonPrincipal>
      }
    >
      <div className="space-y-2">
        {OPCIONES.map((o) => {
          const active = data.concepto === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                seleccionarConcepto(o.value);
                // Al hacer click la opción avanza directo al paso del movimiento
                navigateTo(CONCEPTO_STEP[o.value]);
              }}
              className={cn(
                "flex w-full items-center rounded-xl border px-3 py-2.5 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:bg-muted"
              )}
            >
              <div>
                <p className="text-[13px] text-header">{o.label}</p>
                <p className="text-[12px] text-subtitle">{o.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </StepShellFintech>
  );
}
