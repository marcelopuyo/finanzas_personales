"use client";

// Capa de compatibilidad del wizard de MOVIMIENTOS sobre las primitivas
// compartidas de `components/wizard/ui.tsx` (2026-09-06). Mantiene el export
// histórico de este módulo (los pasos importan desde "./ui") y agrega SOLO el
// comportamiento específico del stepper de movimientos: el modo `direct`
// (ruta /movimientos/nuevo/<tipo>) que oculta el indicador de pasos.
//
// ⚠️ 2026-10-03: el wizard **completo** pasó al layout "fintech" (diseño D, §210)
// ⇒ de acá se retiraron el `StepShell` y el `NavButtons` viejos (ya no los usa
// ningún paso). Las piezas del diseño viven al final de este módulo:
// `StepShellFintech`, `HeroeFintech`, `HeroeValor`, `BotonPrincipal` y
// `BotonSecundario`.
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
} from "@/components/wizard/ui";

/**
 * Shell del paso con el layout **"fintech"** (diseño D, 2026-10-01): cabecera con
 * el `‹` (**cancela y sale**: `volverA`/dashboard; en modo stepper resetea los
 * datos) + título + `N/total`, bloque del **héroe** (opcional: `null` en los
 * pasos que no tienen un número protagonista), contenido agrupado y acción
 * principal full-width en la zona del pulgar.
 *
 * Desde el 2026-10-03 lo usan **todos** los pasos del wizard de movimientos.
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

/** Valor **de sólo lectura** del héroe (mismo tamaño que el input del héroe):
 *  lo usan la confirmación y los pasos cuyo monto lo calcula el servidor
 *  (jornada: horas × precio) o se deduce de los ítems tildados (cobro). */
export function HeroeValor({ children }: { children: ReactNode }) {
  return (
    <p className="text-center text-[34px] leading-none tracking-tight text-header">
      {children}
    </p>
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
