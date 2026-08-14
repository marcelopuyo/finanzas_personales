"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { CurrencyFlag } from "./currency-flag";

export interface ComboboxOption {
  value: string;
  label: string;
  /** ISO 3166-1 del país para la bandera (opcional). */
  flag?: string | null;
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  id?: string;
  name?: string;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
  /** Devuelve texto extra por opción para la búsqueda (ej. código ISO). */
  searchKey?: (o: ComboboxOption) => string;
}

/**
 * Combobox con buscador (mobile-first). Se usa para listas largas con bandera
 * (ej. selector de monedas), porque un <select> nativo no puede pintar
 * banderas dentro de las opciones.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  id,
  name,
  onBlur,
  disabled,
  className,
  searchKey,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  // Cierra al hacer click afuera.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Cierra con Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const extra = searchKey ? searchKey(o).toLowerCase() : "";
      return o.label.toLowerCase().includes(q) || extra.includes(q);
    });
  }, [options, query, searchKey]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        name={name}
        onBlur={onBlur}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-[13px] text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected ? (
            <>
              <CurrencyFlag pais={selected.flag} />
              <span className="truncate">{selected.label}</span>
            </>
          ) : (
            <span className="text-subtitle">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-subtitle transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-subtitle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-transparent text-[13px] text-card-foreground placeholder:text-subtitle focus:outline-none"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-[12px] text-subtitle">
                Sin resultados
              </li>
            )}
            {filtered.map((o) => {
              const active = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors",
                      active
                        ? "bg-primary/10 text-header"
                        : "text-card-foreground hover:bg-muted"
                    )}
                  >
                    <CurrencyFlag pais={o.flag} />
                    <span className="flex-1 truncate">{o.label}</span>
                    {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
