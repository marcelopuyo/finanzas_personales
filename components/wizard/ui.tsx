"use client";

// Primitivas REUTILIZABLES de wizard (2026-09-06, extraídas de
// `app/(app)/movimientos/stepper/ui.tsx` para desacoplarlas del
// `stepper-context` de movimientos). Las consumen el wizard de movimientos
// (vía su `./ui`) y el wizard de alta de trabajos (`trabajo-wizard.tsx`).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { DateFieldInput } from "@/components/ui/date-picker";
import { cn, isoADdMmAa } from "@/lib/utils";

export const inputCls =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-card-foreground placeholder:text-subtitle focus:outline-none focus:ring-2 focus:ring-primary/40";

/** Convierte "YYYY-MM-DD" (o Date) a **`dd-mm-aa`** sin problemas de zona horaria.
 *  Formato ÚNICO de la app (convención §192): antes devolvía `d/m/aaaa`, que dejaba
 *  al paso de Confirmación fuera de la convención. */
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
  return isoADdMmAa(iso);
}

const btnOutline =
  "rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-subtitle transition-colors hover:bg-muted hover:text-header";
const btnPrimary =
  "rounded-lg bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40 hover:enabled:opacity-90";

/**
 * Contenedor genérico de un paso de wizard: encabezado opcional, indicador de
 * progreso opcional (texto + barra), tarjeta con el contenido y footer.
 * Context-free (no depende del stepper de movimientos): quien lo use decide
 * qué encabezado/progreso mostrar.
 */
export function StepShell({
  encabezado,
  paso,
  total,
  mostrarProgreso = true,
  progreso,
  titulo,
  children,
  footer,
}: {
  /** Bloque opcional arriba de todo (ej. botón volver + título de página). */
  encabezado?: ReactNode;
  /** Paso actual (1-based) y total → muestran "Paso X de Y" + barra. */
  paso?: number;
  total?: number;
  mostrarProgreso?: boolean;
  /** Reemplaza el indicador por defecto cuando viene (ej. chips segmentados). */
  progreso?: ReactNode;
  /** Título de la tarjeta (opcional). */
  titulo?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const muestraProgreso = mostrarProgreso && paso != null && total != null;
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      {encabezado}
      {muestraProgreso &&
        (progreso ?? (
          <>
            <p className="mb-3 text-[13px] text-subtitle">
              Paso {paso} de {total}
            </p>
            <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${(paso / total) * 100}%` }}
              />
            </div>
          </>
        ))}
      <div className="rounded-lg border border-border bg-card p-5">
        {titulo && (
          <h2 className="mb-4 text-[15px] text-header">{titulo}</h2>
        )}
        <div className="space-y-4">{children}</div>
      </div>
      {footer && (
        // `data-pie-accion`: el FAB de voz se hace a un lado cuando este pie entra
        // en su franja (así nunca tapa "Siguiente"/"Guardar").
        <div className="mt-4" data-pie-accion="">
          {footer}
        </div>
      )}
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

/**
 * Campo de fecha del wizard. Usa el **calendario propio** (`DateFieldInput`),
 * NO un `<input type="date">` nativo: el nativo mostraba el formato del
 * navegador (mm/dd/yyyy con el locale en inglés) y no se puede forzar por
 * atributo ⇒ acá el formato es siempre el de la app, **dd-mm-aa** (§192).
 */
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
      <DateFieldInput
        value={value}
        onChange={onChange}
        buttonClassName={inputCls}
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
  onSelect,
  minChars = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  buscar: (termino: string) => Promise<string[]>;
  /** Se dispara SOLO cuando el usuario elige una sugerencia de la lista (no al
      tipear). Sirve para autocompletar otros campos con ese dato. */
  onSelect?: (value: string) => void;
  minChars?: number;
  placeholder?: string;
}) {
  const [sugerencias, setSugerencias] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Token para descartar respuestas obsoletas de búsquedas previas.
  const token = useRef(0);
  // ¿El último cambio de `value` vino de que el usuario **escribió**? Solo en ese
  // caso se abre el desplegable. Si el valor cambia por fuera (al **remontar** el
  // paso con un valor ya cargado —p. ej. volviendo desde la Confirmación— o al
  // dictar por voz), la lista se abría sola y quedaba abierta (bug 2026-10-01).
  const buscarPorUsuario = useRef(false);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const termino = value.trim();
    const miToken = ++token.current;
    // Se **consume** el flag: rige solo para el cambio de valor que disparó este
    // efecto (el siguiente cambio, si no vuelve a escribir, no abre la lista).
    const porUsuario = buscarPorUsuario.current;
    buscarPorUsuario.current = false;
    timer.current = setTimeout(() => {
      // Cambio de valor sin interacción del usuario (remontaje del paso, dictado,
      // selección de una sugerencia) ⇒ no buscar ni abrir la lista.
      if (!porUsuario) return;
      if (termino.length < minChars) {
        setSugerencias([]);
        setAbierto(false);
        setCargando(false);
        return;
      }
      setCargando(true);
      buscar(termino)
        .then((res) => {
          if (token.current !== miToken) return;
          setSugerencias(
            res.filter((s) => s.toLowerCase() !== termino.toLowerCase())
          );
          setAbierto(true);
        })
        .catch(() => {
          if (token.current === miToken) setSugerencias([]);
        })
        .finally(() => {
          if (token.current === miToken) setCargando(false);
        });
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
        onChange={(e) => {
          // Marca que el cambio lo hizo el usuario ⇒ sí se puede abrir la lista.
          buscarPorUsuario.current = true;
          onChange(e.target.value);
        }}
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
                  onSelect?.(s);
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
  hero = false,
  heroPrefix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  allowNegative?: boolean;
  placeholder?: string;
  /** Variante **héroe**: input grande y centrado, **sin label**. El llamador
   *  ubica el rótulo (la usan los wizards de gasto/transferencia/ajuste, diseño D
   *  `2026-10-01`). Default: `false` ⇒ comportamiento de siempre.
   *  ⚠️ Lleva `data-fuente-grande`: lo exceptúa de la regla de iOS que fuerza
   *  16px a los controles en el celular (globals.css) — sin eso el héroe se
   *  veía chico en mobile. */
  hero?: boolean;
  /** Símbolo de moneda que se muestra a la izquierda del héroe (ej. `US$`). */
  heroPrefix?: string;
}) {
  // `type="text"` + `inputMode="decimal"`: en móvil `type="number"` no muestra
  // la tecla de separador decimal (iOS y algunos Android según el locale).
  const [text, setText] = useState(value === 0 ? "" : String(value));
  const editedBySelf = useRef(false);

  const textToNumber = (s: string): number => {
    if (s === "" || s === "-" || s === "." || s === "-.") return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  useEffect(() => {
    if (editedBySelf.current) {
      editedBySelf.current = false;
      return;
    }
    setText(value === 0 ? "" : String(value));
  }, [value]);

  const handleChange = (raw: string) => {
    let s = raw.replace(/,/g, ".");
    s = s.replace(/[^0-9.-]/g, "");
    const firstDot = s.indexOf(".");
    if (firstDot !== -1) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
    }
    if (allowNegative) {
      s = s.replace(/(?!^)-/g, "");
      s = s.replace(/^-+/, "-");
    } else {
      s = s.replace(/-/g, "");
    }
    setText(s);
    editedBySelf.current = true;
    onChange(textToNumber(s));
  };

  const toggleSign = () => {
    editedBySelf.current = true;
    if (text.startsWith("-")) {
      const positive = text.slice(1);
      setText(positive);
      onChange(textToNumber(positive));
    } else {
      const negative = `-${text}`;
      setText(negative);
      onChange(textToNumber(negative));
    }
  };

  if (hero) {
    return (
      <div className="flex items-center justify-center gap-2">
        {heroPrefix && (
          <span className="text-[20px] font-medium text-subtitle">
            {heroPrefix}
          </span>
        )}
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label={label}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder ?? "0"}
          data-fuente-grande=""
          className="w-45 max-w-full bg-transparent text-center text-[34px] leading-none tracking-tight text-header placeholder:text-subtitle/50 focus:outline-none"
        />
        {allowNegative && (
          <button
            type="button"
            onClick={toggleSign}
            aria-label={
              text.startsWith("-") ? "Cambiar a positivo" : "Cambiar a negativo"
            }
            title="+/−"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted text-[16px] text-card-foreground transition-colors hover:bg-muted/70"
          >
            {text.startsWith("-") ? "+" : "−"}
          </button>
        )}
      </div>
    );
  }

  return (
    <Campo label={label}>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className={cn(inputCls, allowNegative && "pr-12")}
        />
        {allowNegative && (
          <button
            type="button"
            onClick={toggleSign}
            aria-label={
              text.startsWith("-") ? "Cambiar a positivo" : "Cambiar a negativo"
            }
            title="+/−"
            className="absolute inset-y-1 right-1 flex w-10 items-center justify-center rounded-md border border-border bg-muted text-[16px] text-card-foreground transition-colors hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {text.startsWith("-") ? "+" : "−"}
          </button>
        )}
      </div>
    </Campo>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  disabled = false,
  onCreate,
  createLabel,
  createLabelFor,
  searchPlaceholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  /** Si viene, el campo pasa a ser un COMBOBOX con buscador y fila de alta
      rápida "＋ …" al pie (opción A): recibe el texto buscado como prefill.
      Sin esta prop sigue siendo el `<select>` nativo de siempre. */
  onCreate?: (prefill: string) => void;
  /** Texto de la fila de alta rápida (p. ej. "Nueva categoría"). */
  createLabel?: string;
  /** Si viene, la fila de alta muestra el texto buscado (ej. `Usar «Peaje»`). */
  createLabelFor?: (query: string) => string;
  /** Placeholder del buscador del combobox. */
  searchPlaceholder?: string;
}) {
  // Con alta rápida se usa el Combobox compartido: un <select> nativo no puede
  // mostrar una acción dentro de la lista.
  if (onCreate) {
    return (
      <Campo label={label}>
        <Combobox
          value={value}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          disabled={disabled}
          onCreate={onCreate}
          createLabel={createLabel}
          createLabelFor={createLabelFor}
          searchPlaceholder={searchPlaceholder}
        />
      </Campo>
    );
  }
  return (
    <Campo label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(inputCls, disabled && "cursor-not-allowed opacity-60")}
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

/**
 * Botones de navegación genéricos (context-free). A la izquierda se muestra el
 * botón que corresponda: **los dos** ("Atrás" + "Cancelar") cuando el paso tiene
 * sub-pasos internos y hay que poder retroceder sin salir (2026-09-26); si no,
 * el de siempre. A la derecha siempre el botón principal (`onNext`).
 */
export function NavButtons({
  onBack,
  onNext,
  nextDisabled = false,
  nextLabel = "Siguiente",
  backLabel = "Atrás",
  onCancel,
  cancelLabel = "Cancelar",
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
  backLabel?: string;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {onBack && (
          <button type="button" onClick={onBack} className={btnOutline}>
            {backLabel}
          </button>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} className={btnOutline}>
            {cancelLabel}
          </button>
        )}
        {!onBack && !onCancel && <span />}
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className={btnPrimary}
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

/* ─────────────────────────────────────────────────────────────────────
   LAYOUT "FINTECH" (diseño D, 2026-10-01 · unificado el 2026-10-03)

   El paso del wizard se lee como una pantalla "de banco": cabecera con el `‹`
   (**cancela y sale** del wizard) + título corto + `N/total`, el **héroe** (el
   número protagonista) grande y centrado, el contenido agrupado en tarjetas y
   la acción principal **full-width** en la zona del pulgar.

   Es **context-free** (igual que el resto de este módulo): quien lo usa resuelve
   el `‹` con `onCancel`. Las piezas las consumen el wizard de movimientos (que
   las reexporta desde su `./ui`) y el wizard de alta de trabajos.
   ───────────────────────────────────────────────────────────────────── */
export function StepShellFintech({
  titulo,
  paso,
  total,
  onCancel,
  cancelDisabled = false,
  heroe,
  children,
  footer,
}: {
  titulo: string;
  /** Paso actual y total: muestran "N/total" en la cabecera. Sin ellos no se pinta. */
  paso?: number;
  total?: number;
  /** Acción del `‹` de la cabecera: **cancelar y salir** del wizard. */
  onCancel: () => void;
  /** Deshabilita el `‹` (p. ej. mientras se guarda). */
  cancelDisabled?: boolean;
  /** Bloque del héroe (el monto). Opcional: hay pasos sin número protagonista. */
  heroe?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl py-4">
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelDisabled}
          aria-label="Cancelar"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted text-subtitle transition-colors hover:text-header disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-[17px] text-header">{titulo}</h1>
        {paso != null && total != null && (
          <span className="ml-auto text-[12px] text-subtitle">
            {paso}/{total}
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
