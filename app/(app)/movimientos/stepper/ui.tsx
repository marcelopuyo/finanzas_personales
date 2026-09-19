"use client";

// Capa de compatibilidad del wizard de MOVIMIENTOS sobre las primitivas
// compartidas de `components/wizard/ui.tsx` (2026-09-06). Mantiene el export
// histórico de este módulo (los pasos importan desde "./ui") y agrega SOLO el
// comportamiento específico del stepper de movimientos: el modo `direct`
// (ruta /movimientos/nuevo/<tipo>) que oculta el indicador de pasos y cambia
// "Atrás" por "Cancelar → dashboard".
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMovimientoStepper } from "./stepper-context";
import { CONCEPTO_TITULO_PAGINA } from "./types";
import {
  StepShell as StepShellBase,
  NavButtons as NavButtonsBase,
} from "@/components/wizard/ui";

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
} from "@/components/wizard/ui";

/** Contenedor del wizard de movimientos: conserva el encabezado "Movimientos"
 * y el indicador de pasos solo en modo stepper (no directo). En modo DIRECTO el
 * encabezado nombra la operación (ej. "Pago de préstamo"): el usuario entró a
 * hacer eso, no a elegir un tipo de movimiento. */
export function StepShell({
  title,
  step,
  total,
  children,
  footer,
}: {
  title: string;
  step: number;
  total: number;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { direct, data } = useMovimientoStepper();
  const tituloPagina = direct
    ? data.concepto
      ? CONCEPTO_TITULO_PAGINA[data.concepto]
      : "Movimientos"
    : "Movimientos";
  return (
    <StepShellBase
      encabezado={
        <h1 className="mb-1 text-[18px] font-semibold text-header">
          {tituloPagina}
        </h1>
      }
      paso={direct ? undefined : step}
      total={direct ? undefined : total}
      titulo={title}
      footer={footer}
    >
      {children}
    </StepShellBase>
  );
}

/** Botones del wizard de movimientos. En modo directo: Cancelar (→ volverA si
 * viene, si no → dashboard) + Siguiente. En modo stepper: Atrás + Siguiente. */
export function NavButtons({
  onBack,
  onNext,
  nextDisabled = false,
  nextLabel = "Siguiente",
  backLabel = "Atrás",
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  backLabel?: string;
}) {
  const { direct, volverA } = useMovimientoStepper();
  const router = useRouter();
  return (
    <NavButtonsBase
      onBack={direct ? undefined : onBack}
      onCancel={
        direct ? () => router.push(volverA ?? "/dashboard") : undefined
      }
      onNext={onNext}
      nextDisabled={nextDisabled}
      nextLabel={nextLabel}
      backLabel={backLabel}
    />
  );
}
