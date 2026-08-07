"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const inputCls =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-card-foreground placeholder:text-subtitle focus:outline-none focus:ring-2 focus:ring-primary/40";

/** Convierte "YYYY-MM-DD" (o Date) a "D/M/YYYY" sin problemas de zona horaria. */
export function formatFecha(value: string | Date | null | undefined): string {
  if (!value) return "";
  let iso: string;
  if (typeof value === "string") {
    iso = value.slice(0, 10);
  } else if (value instanceof Date && !isNaN(value.getTime())) {
    iso = value.toISOString().slice(0, 10);
  } else {
    return String(value);
  }
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
}

/** Contenedor del wizard: título, indicador de progreso y tarjeta con contenido. */
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
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-1 text-[18px] font-semibold text-header">Movimientos</h1>
      <p className="mb-3 text-[13px] text-subtitle">
        Paso {step} de {total}
      </p>
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-[15px] font-semibold text-header">{title}</h2>
        <div className="space-y-4">{children}</div>
      </div>

      <div className="mt-4">{footer}</div>
    </div>
  );
}

/** Wrapper de campo con label. */
export function Campo({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-header">
        {label}
      </label>
      {children}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Campo label={label}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
    </Campo>
  );
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Campo label={label}>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </Campo>
  );
}

export function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Campo label={label}>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </Campo>
  );
}

/**
 * Campo de texto con autocompletado: cuando se ingresan `minChars` (default 3)
 * caracteres, ejecuta `buscar` (con debounce) y muestra sugerencias para
 * seleccionar con un click.
 */
export function AutoCompleteField({
  label,
  value,
  onChange,
  buscar,
  minChars = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  buscar: (termino: string) => Promise<string[]>;
  minChars?: number;
  placeholder?: string;
}) {
  const [sugerencias, setSugerencias] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const termino = value.trim();
    if (termino.length < minChars) {
      setSugerencias([]);
      setAbierto(false);
      setCargando(false);
      return;
    }

    timer.current = setTimeout(async () => {
      setCargando(true);
      try {
        const res = await buscar(termino);
        setSugerencias(
          res.filter((s) => s.toLowerCase() !== termino.toLowerCase())
        );
        setAbierto(true);
      } catch {
        setSugerencias([]);
      } finally {
        setCargando(false);
      }
    }, 300);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, buscar, minChars]);

  return (
    <Campo label={label}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setAbierto(false)}
        placeholder={placeholder}
        className={inputCls}
      />
      {cargando && (
        <p className="mt-1 text-[12px] text-subtitle">Buscando...</p>
      )}
      {abierto && sugerencias.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-md border border-border bg-card">
          {sugerencias.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s);
                  setAbierto(false);
                }}
                className="block w-full px-3 py-2 text-left text-[13px] text-card-foreground transition-colors hover:bg-muted"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Campo>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  allowNegative = false,
  placeholder,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  allowNegative?: boolean;
  placeholder?: string;
}) {
  return (
    <Campo label={label}>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min={allowNegative ? undefined : 0}
        value={value === 0 ? "" : String(value)}
        onChange={(e) =>
          onChange(e.target.value === "" ? 0 : Number(e.target.value))
        }
        placeholder={placeholder}
        className={inputCls}
      />
    </Campo>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <Campo label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Campo>
  );
}

/** Botones Atrás / Siguiente del wizard. */
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
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onBack}
        className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header"
      >
        {backLabel}
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className={cn(
          "rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity",
          nextDisabled ? "cursor-not-allowed opacity-40" : "hover:opacity-90"
        )}
      >
        {nextLabel}
      </button>
    </div>
  );
}

/** Fila de resumen (label + valor) para el paso de Confirmación. */
export function Fila({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2 text-[13px] last:border-0">
      <span className="text-subtitle">{label}</span>
      <span className="text-right font-medium text-header">{value}</span>
    </div>
  );
}
