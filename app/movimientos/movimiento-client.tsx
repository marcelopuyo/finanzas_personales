"use client";

import { MovimientoProvider, useMovimientoStepper } from "./stepper/stepper-context";
import { Selector } from "./stepper/selector";
import { CobroSueldo } from "./stepper/cobro-sueldo";
import { PagoPrestamo } from "./stepper/pago-prestamo";
import { AjusteCuenta } from "./stepper/ajuste-cuenta";
import { PagoGasto } from "./stepper/pago-gasto";
import { GastoDirecto } from "./stepper/gasto-directo";
import { Transferencia } from "./stepper/transferencia";
import { Confirmacion } from "./stepper/confirmacion";
import type { MovimientoOptions } from "./stepper/types";

const STEPS = [
  Selector,
  CobroSueldo,
  PagoPrestamo,
  AjusteCuenta,
  PagoGasto,
  GastoDirecto,
  Transferencia,
  Confirmacion,
];

export function MovimientoClient({
  options,
  fechaHoy,
}: {
  options: MovimientoOptions;
  fechaHoy: string;
}) {
  return (
    <MovimientoProvider options={options} fechaHoy={fechaHoy}>
      <StepperBody />
    </MovimientoProvider>
  );
}

function StepperBody() {
  const { activeStep } = useMovimientoStepper();
  const Step = STEPS[activeStep];
  return <Step />;
}
