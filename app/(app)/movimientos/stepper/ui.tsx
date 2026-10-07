"use client";

// Capa de compatibilidad del wizard de MOVIMIENTOS sobre las primitivas
// compartidas de `components/wizard/ui.tsx` (2026-09-06). Mantiene el export
// histórico de este módulo (los pasos importan desde "./ui") y agrega SOLO el
// comportamiento específico del stepper de movimientos: el modo `direct`
// (ruta /movimientos/nuevo/<tipo>) que oculta el indicador de pasos.
//
// ⚠️ 2026-10-03: el wizard **completo** pasó al layout "fintech" (diseño D, §210)
// ⇒ de acá se retiraron el `StepShell` y el `NavButtons` viejos (ya no los usa
// ningún paso) y las piezas del diseño (`StepShellFintech`, `HeroeFintech`,
// `HeroeValor`, `BotonPrincipal`, `BotonSecundario`) se movieron a las primitivas
// compartidas `components/wizard/ui.tsx`, porque ahora también las usa el wizard
// de alta de trabajos. Acá queda **solo** el wrapper de `StepShellFintech` que
// resuelve el `‹` con el contexto del stepper.
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMovimientoStepper } from "./stepper-context";

// Primitivas compartidas re-exportadas tal cual (no dependen del contexto).
export {
  inputCls,
  formatFecha,
  Campo,
  TextField,
  DateField,
  TimeField,
  AutoCompleteField,
  NumberField,
  SelectField,
  Fila,
  HeroeFintech,
  HeroeValor,
  BotonPrincipal,
  BotonSecundario,
} from "@/components/wizard/ui";
import { StepShellFintech as StepShellFintechBase } from "@/components/wizard/ui";

/**
 * Paso del wizard de movimientos con el layout **"fintech"** (diseño D): el
 * `StepShellFintech` compartido + el comportamiento del stepper, que es lo único
 * que agrega esta capa:
 *
 * - el `‹` de la cabecera **cancela y sale** del wizard: va al origen
 *   (`volverA`) o al dashboard y, en **modo stepper** (`/movimientos`), además
 *   **resetea** los datos;
 * - el indicador `N/total` se oculta en **modo directo**
 *   (`/movimientos/nuevo/<tipo>`), donde el usuario entró a hacer una sola cosa.
 *
 * Desde el 2026-10-03 lo usan **todos** los pasos del wizard de movimientos.
 */
export function StepShellFintech({
  titulo,
  step,
  total,
  heroe,
  accion,
  cancelDisabled = false,
  children,
  footer,
}: {
  titulo: string;
  step: number;
  total: number;
  heroe: ReactNode;
  /** Acción extra de la cabecera (icono a la derecha del título). */
  accion?: ReactNode;
  /** Deshabilita el `‹` de la cabecera (p. ej. mientras se guarda). */
  cancelDisabled?: boolean;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { direct, volverA, resetData } = useMovimientoStepper();
  const router = useRouter();
  const volver = () => {
    if (!direct) resetData();
    router.push(volverA ?? "/dashboard");
  };
  return (
    <StepShellFintechBase
      titulo={titulo}
      paso={direct ? undefined : step}
      total={direct ? undefined : total}
      onCancel={volver}
      cancelDisabled={cancelDisabled}
      accion={accion}
      heroe={heroe}
      footer={footer}
    >
      {children}
    </StepShellFintechBase>
  );
}
