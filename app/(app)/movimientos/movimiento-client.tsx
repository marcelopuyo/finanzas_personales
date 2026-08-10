"use client";

import { MovimientoProvider, useMovimientoStepper } from "./stepper/stepper-context";
import { Selector } from "./stepper/selector";
import { CobroSueldo } from "./stepper/cobro-sueldo";
import { PagoPrestamo } from "./stepper/pago-prestamo";
import { AjusteCuenta } from "./stepper/ajuste-cuenta";
import { PagoGasto } from "./stepper/pago-gasto";
import { GastoDirecto } from "./stepper/gasto-directo";
import { Transferencia } from "./stepper/transferencia";
import { JornadaTrabajo } from "./stepper/jornada-trabajo";
import { Confirmacion } from "./stepper/confirmacion";
import type { MovimientoInitial, MovimientoOptions } from "./stepper/types";

const STEPS = [
  Selector,
  CobroSueldo,
  PagoPrestamo,
  AjusteCuenta,
  PagoGasto,
  GastoDirecto,
  Transferencia,
  JornadaTrabajo,
  Confirmacion,
];

export function MovimientoClient({
  options,
  fechaHoy,
  initial,
  direct = false,
}: {
  options: MovimientoOptions;
  fechaHoy: string;
  /** Pre-carga opcional desde query params (tarjetas del dashboard). */
  initial?: MovimientoInitial;
  /** Modo directo (sin stepper): oculta selector/progreso; formulario → confirmación. */
  direct?: boolean;
}) {
  return (
    <MovimientoProvider
      options={options}
      fechaHoy={fechaHoy}
      initial={initial}
      direct={direct}
    >
      <StepperBody />
    </MovimientoProvider>
  );
}

function StepperBody() {
  const { activeStep } = useMovimientoStepper();
  const Step = STEPS[activeStep];
  return <Step />;
}
