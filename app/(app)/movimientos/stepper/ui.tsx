"use client";

// Capa de compatibilidad del wizard de MOVIMIENTOS sobre las primitivas
// compartidas de `components/wizard/ui.tsx` (2026-09-06). Mantiene el export
// histórico de este módulo (los pasos importan desde "./ui") y agrega SOLO el
// comportamiento específico del stepper de movimientos: el modo `direct`
// (ruta /movimientos/nuevo/<tipo>) que oculta el indicador de pasos y cambia
// "Atrás" por "Cancelar → dashboard".
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
        <h1 className="mb-1 text-[18px] text-header">
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
 * viene, si no → dashboard) + Siguiente. En modo stepper: Atrás + Siguiente.
 * Con `atrasEnDirecto` el paso pide **también** "Atrás" en modo directo: lo usan
 * los pasos con **sub-pasos internos** (hoy sólo "Cobrar trabajo", 2026-09-26),
 * donde hay que poder volver a la pantalla anterior sin salir del wizard. */
export function NavButtons({
  onBack,
  onNext,
  nextDisabled = false,
  nextLabel = "Siguiente",
  backLabel = "Atrás",
  atrasEnDirecto = false,
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  backLabel?: string;
  atrasEnDirecto?: boolean;
}) {
  const { direct, volverA } = useMovimientoStepper();
  const router = useRouter();
  return (
    <NavButtonsBase
      onBack={direct && !atrasEnDirecto ? undefined : onBack}
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

/**
 * Shell del paso con el layout **"fintech"** (diseño D, 2026-10-01): cabecera con
 * el `‹` (**cancela y sale**: `volverA`/dashboard; en modo stepper resetea los
 * datos) + título + `N/total`, bloque del **héroe**, contenido agrupado y acción
 * principal full-width en la zona del pulgar. Lo usan gasto, transferencia y ajuste.
 */
export function StepShellFintech({
  titulo,
  step,
  total,
  heroe,
  cancelDisabled = false,
  children,
  footer,
}: {
  titulo: string;
  step: number;
  total: number;
  heroe: ReactNode;
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
    <div className="mx-auto max-w-xl py-4">
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={volver}
          disabled={cancelDisabled}
          aria-label="Cancelar"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted text-subtitle transition-colors hover:text-header disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-[17px] text-header">{titulo}</h1>
        {!direct && (
          <span className="ml-auto text-[12px] text-subtitle">
            {step}/{total}
          </span>
        )}
      </div>
      {heroe}
      {children}
      {/* `data-pie-accion`: el FAB de voz se corre cuando este pie entra en su franja. */}
      <div className="mt-4 space-y-2" data-pie-accion="">
        {footer}
      </div>
    </div>
  );
}

/** Bloque del **héroe** (el monto) con su rótulo, centrado. */
export function HeroeFintech({
  children,
  etiqueta,
}: {
  children: ReactNode;
  etiqueta: ReactNode;
}) {
  return (
    <div className="mb-5">
      {children}
      <p className="mt-2 text-center text-[12px] text-subtitle">{etiqueta}</p>
    </div>
  );
}

/** Acción principal del pie: full-width, en la zona del pulgar. */
export function BotonPrincipal({
  onClick,
  disabled = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-3.5 text-[15px] text-primary-foreground transition-opacity hover:enabled:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Acción secundaria del pie (full-width, contorno). */
export function BotonSecundario({
  onClick,
  disabled = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border px-4 py-3 text-[14px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header disabled:opacity-50"
    >
      {children}
    </button>
  );
}
