"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, isoADdMmAa, todayLocalISODate } from "@/lib/utils";

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
 * Alcance (2026-09-27): el calendario propio es el **ÚNICO control de fecha de
 * la app**, en desktop y en mobile. Se retiraron los `<input type="date">`
 * nativos porque **el formato lo impone el navegador** (con el locale en inglés
 * mostraban mm/dd/yyyy y no se puede forzar por atributo): acá el campo muestra
 * siempre el formato de la app, **dd-mm-aa**.
 *
 * Piezas exportadas:
 * - `DateFieldInput` — campo completo (rótulo opcional + botón + calendario en
 *   el flujo): lo usan los formularios CRUD, el wizard y el modal de ítems.
 * - `DateRangeFields` — par Desde/Hasta (filtros del dashboard).
 * - `DateField` — botón suelto, cuando el panel lo abre quien lo contiene.
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

/** Botón de fecha: muestra el valor en **dd-mm-aa** (formato de la app). */
export function DateField({
  label,
  value,
  abierto = false,
  onClick,
  className,
  buttonClassName,
  placeholder = "Seleccionar",
  ariaLabel,
}: {
  /** Rótulo arriba del botón (opcional: los formularios ya pintan el suyo). */
  label?: string;
  /** Texto para lectores de pantalla cuando NO hay rótulo visible. */
  ariaLabel?: string;
  /** Valor en ISO "YYYY-MM-DD" ("" = sin valor). */
  value: string;
  abierto?: boolean;
  onClick: () => void;
  className?: string;
  /** Clases extra del botón, para calzar con el input del formulario contenedor. */
  buttonClassName?: string;
  placeholder?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && <span className="text-[12px] text-subtitle">{label}</span>}
      <button
        type="button"
        onClick={onClick}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={`${label ?? ariaLabel ?? "Fecha"}: ${
          value ? isoADdMmAa(value) : "seleccionar fecha"
        }`}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md border bg-card px-2.5 py-1.5 text-left text-[13px] text-card-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40",
          abierto
            ? "border-primary/50 ring-2 ring-primary/20"
            : "border-border hover:bg-muted",
          buttonClassName
        )}
      >
        <span className={cn("truncate", !value && "text-subtitle")}>
          {value ? isoADdMmAa(value) : placeholder}
        </span>
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-subtitle" />
      </button>
    </div>
  );
}

/**
 * Campo de fecha COMPLETO: rótulo opcional + botón + calendario en el flujo.
 *
 * Es el control que usan los formularios (**reemplaza a los `<input type="date">`
 * nativos**, que mostraban el formato del navegador). `clearable` agrega
 * "Limpiar" para los campos que aceptan vacío (ej. un gasto sin `fechaPago`).
 */
export function DateFieldInput({
  label,
  value,
  onChange,
  className,
  buttonClassName,
  clearable = false,
  placeholder,
  ariaLabel,
}: {
  label?: string;
  /** Valor en ISO "YYYY-MM-DD" ("" = sin valor). */
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  buttonClassName?: string;
  clearable?: boolean;
  placeholder?: string;
  /** Texto para lectores de pantalla cuando NO hay rótulo visible. */
  ariaLabel?: string;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <DateField
        label={label}
        value={value}
        abierto={abierto}
        onClick={() => setAbierto((v) => !v)}
        buttonClassName={buttonClassName}
        placeholder={placeholder}
        ariaLabel={ariaLabel}
      />
      {clearable && value && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setAbierto(false);
            }}
            className="text-[11px] text-subtitle transition-colors hover:text-header"
          >
            Limpiar
          </button>
        </div>
      )}
      {abierto && (
        <CalendarPanel
          value={value}
          onSelect={(iso) => {
            onChange(iso);
            setAbierto(false);
          }}
          className="mt-2"
        />
      )}
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

/**
 * Par Desde/Hasta con el calendario inline debajo: tocar un campo abre el
 * calendario en el mes de ese valor y elegir un día lo asigna y lo cierra.
 *
 * Un solo control en mobile y desktop (2026-09-27): antes en `<sm` se usaban
 * dos `<input type="date">` nativos (el picker lo abría el SO), pero mostraban
 * el formato del navegador ⇒ ahora el calendario propio es el único.
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
  );
}
