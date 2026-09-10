"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, todayLocalISODate } from "@/lib/utils";

/**
 * Selector de fecha PROPIO (HTML/CSS, sin librerías ni input nativo).
 *
 * Motivo (2026-09-10): el `<input type="date">` nativo no abre su selector en
 * navegadores embebidos (navegador integrado de VS Code / Electron): el click
 * en el ícono no hace nada, `showPicker()` es no-op y tampoco responde a
 * `ArrowDown`/`Space`. En mobile dependía del picker del sistema operativo.
 * Con este calendario el comportamiento es el MISMO en desktop y mobile, con
 * celdas pensadas para touch (36px de alto) y el estilo del tema.
 *
 * Alcance: el calendario propio se usa SOLO en desktop (`sm+`). En mobile se
 * conserva el `<input type="date">` nativo, donde el selector lo abre el sistema
 * operativo y ya funciona bien (`sm` es el corte mobile/desktop que usa el
 * dashboard en el resto de los botones de la barra de filtros).
 *
 * Piezas exportadas:
 * - `DateRangeFields` — par Desde/Hasta responsive: nativo en mobile y
 *   calendario propio en `sm+` (lo que usan los filtros del dashboard). El
 *   panel va en el flujo (no flotante) así no lo recorta el `overflow` del Modal.
 * - `DateField` — campo de fecha suelto (para reusarlo en otros formularios).
 * - `CalendarPanel` — el calendario.
 */

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** Encabezado de columnas, con la semana arrancando el LUNES. */
const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO "YYYY-MM-DD" → "dd/mm/aaaa" (por partes, sin zonas horarias). */
export function isoADdMmAaaa(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

/** Suma `delta` meses a "YYYY-MM". */
function mesMas(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

type CeldaDia = { iso: string; dia: number } | null;

/**
 * Semanas (lunes → domingo) del mes "YYYY-MM". Los huecos antes del día 1 y
 * después del último día van como `null`. Todo con UTC para no correrse de día.
 */
export function semanasDelMes(mes: string): CeldaDia[][] {
  const [y, m] = mes.split("-").map(Number);
  // getUTCDay(): 0=domingo … 6=sábado → con lunes primero: (dow + 6) % 7.
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const diasEnMes = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const celdas: CeldaDia[] = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) {
    celdas.push({ iso: `${y}-${pad(m)}-${pad(d)}`, dia: d });
  }
  while (celdas.length % 7 !== 0) celdas.push(null);

  const semanas: CeldaDia[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}

/** Campo de fecha: botón con el aspecto del input del tema. */
export function DateField({
  label,
  value,
  abierto = false,
  onClick,
  className,
}: {
  label: string;
  /** Valor en ISO "YYYY-MM-DD" ("" = sin valor). */
  value: string;
  abierto?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[12px] text-subtitle">{label}</span>
      <button
        type="button"
        onClick={onClick}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={`${label}: ${value ? isoADdMmAaaa(value) : "seleccionar fecha"}`}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1.5 text-left text-[13px] text-card-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40",
          abierto
            ? "border-primary/50 ring-2 ring-primary/20"
            : "border-border hover:bg-muted"
        )}
      >
        <span className={cn("truncate", !value && "text-subtitle")}>
          {value ? isoADdMmAaaa(value) : "Seleccionar"}
        </span>
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-subtitle" />
      </button>
    </div>
  );
}

/** Calendario mensual (navegación por mes + acceso rápido a "Hoy"). */
export function CalendarPanel({
  value,
  onSelect,
  className,
}: {
  value: string;
  onSelect: (iso: string) => void;
  className?: string;
}) {
  const hoy = todayLocalISODate();
  const [mes, setMes] = useState(() => (value || hoy).slice(0, 7));
  const semanas = useMemo(() => semanasDelMes(mes), [mes]);
  const [anio, numMes] = mes.split("-").map(Number);

  const navCls =
    "flex h-7 w-7 items-center justify-center rounded-md text-subtitle transition-colors hover:bg-muted hover:text-header";

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-2 shadow-sm",
        className
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setMes(mesMas(mes, -1))}
          aria-label="Mes anterior"
          className={navCls}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[13px] font-medium text-header first-letter:uppercase">
          {MESES[numMes - 1]} {anio}
        </span>
        <button
          type="button"
          onClick={() => setMes(mesMas(mes, 1))}
          aria-label="Mes siguiente"
          className={navCls}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {DIAS_SEMANA.map((d) => (
          <span
            key={d}
            className="py-1 text-center text-[11px] font-medium text-subtitle"
          >
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {semanas.flat().map((c, i) =>
          c ? (
            <button
              key={c.iso}
              type="button"
              onClick={() => onSelect(c.iso)}
              aria-label={c.iso}
              aria-current={c.iso === value ? "date" : undefined}
              className={cn(
                "flex h-9 items-center justify-center rounded-md text-[13px] transition-colors",
                c.iso === value
                  ? "bg-primary font-semibold text-primary-foreground"
                  : c.iso === hoy
                    ? "font-semibold text-primary hover:bg-muted"
                    : "text-card-foreground hover:bg-muted"
              )}
            >
              {c.dia}
            </button>
          ) : (
            <span key={`hueco-${i}`} aria-hidden="true" className="h-9" />
          )
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setMes(hoy.slice(0, 7));
          onSelect(hoy);
        }}
        className="mt-1 w-full rounded-md py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-muted"
      >
        Hoy
      </button>
    </div>
  );
}

/** Campo de fecha nativo (mobile): el selector lo abre el sistema operativo. */
function NativeDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[12px] text-subtitle">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-[13px] text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </div>
  );
}

/**
 * Par Desde/Hasta con el calendario inline debajo: tocar un campo abre el
 * calendario en el mes de ese valor y elegir un día lo asigna y lo cierra.
 *
 * Responsive por CSS (sin detección en JS, así no hay problemas de hidratación):
 * - `<sm` (mobile): dos inputs `type="date"` nativos (picker del SO).
 * - `sm+` (desktop): dos `DateField` + `CalendarPanel` propio.
 */
export function DateRangeFields({
  desde,
  hasta,
  onChangeDesde,
  onChangeHasta,
  className,
}: {
  desde: string;
  hasta: string;
  onChangeDesde: (iso: string) => void;
  onChangeHasta: (iso: string) => void;
  className?: string;
}) {
  const [abierto, setAbierto] = useState<"desde" | "hasta" | null>(null);

  const alternar = (cual: "desde" | "hasta") =>
    setAbierto((prev) => (prev === cual ? null : cual));

  return (
    <div className={className}>
      {/* Mobile: input nativo (ya funcionaba bien; no se toca). */}
      <div className="grid grid-cols-2 gap-3 sm:hidden">
        <NativeDateField label="Desde" value={desde} onChange={onChangeDesde} />
        <NativeDateField label="Hasta" value={hasta} onChange={onChangeHasta} />
      </div>

      {/* Desktop: calendario propio. En mobile queda oculto, y como los
          `DateField` no se pueden tocar, `abierto` nunca se activa. */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-2 gap-3">
          <DateField
            label="Desde"
            value={desde}
            abierto={abierto === "desde"}
            onClick={() => alternar("desde")}
          />
          <DateField
            label="Hasta"
            value={hasta}
            abierto={abierto === "hasta"}
            onClick={() => alternar("hasta")}
          />
        </div>

        {abierto && (
          <CalendarPanel
            // key: al cambiar de campo, el panel se reabre en el mes de ESE valor.
            key={abierto}
            value={abierto === "desde" ? desde : hasta}
            onSelect={(iso) => {
              if (abierto === "desde") onChangeDesde(iso);
              else onChangeHasta(iso);
              setAbierto(null);
            }}
            className="mt-2"
          />
        )}
      </div>
    </div>
  );
}
