"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Banknote, CalendarPlus, ListPlus, Plus } from "lucide-react";
import { LinkNavStatus } from "@/components/ui/nav-progress";
import { useTap } from "@/lib/tap";
import { cn } from "@/lib/utils";

/**
 * **FAB ➕ con speed-dial** de `/trabajo` (decisión del usuario 2026-09-26,
 * variante C del preview `favicons/preview-acciones-periodos-trabajo.html`).
 *
 * Las acciones del circuito viven acá y **no** en el ⋯ del encabezado (que queda
 * sólo con "Gestionar trabajos"), porque tienen que estar **siempre a la vista**:
 * este panel existe justamente para cobrar y cargar.
 *
 * - **Cobrar trabajo** va pegado al ➕ (es la acción principal, la que más se usa)
 *   y se pinta con el tinte verde de los chips de la app, el mismo color del
 *   monto pendiente en la grilla.
 * - El ➕ **gira a ✕** al abrir; fuera de eso no cambia de forma.
 *
 * 🔑 **Por qué acá y no por fila**: los trabajos `fijo`/`horas_fijas` **no generan
 * ítems** ⇒ nunca aparecen como fila en la grilla, así que una acción por fila los
 * dejaría sin punto de entrada. El wizard de cobro, en cambio, lista **todos** los
 * trabajos en su primer paso.
 *
 * 📍 **Posición**: la resuelve `globals.css` (`data-fab-acciones` desplaza el FAB
 * de voz a la izquierda) — el contenedor es `pointer-events-none` para no comerse
 * los toques de la grilla que quedan entre las píldoras, y sólo las píldoras y el
 * botón lo reactivan.
 */
const ACCIONES = [
  // De arriba hacia abajo: la principal queda al lado del ➕.
  { tipo: "jornada", etiqueta: "Cargar jornada", Icono: CalendarPlus },
  { tipo: "tarea", etiqueta: "Cargar tarea", Icono: ListPlus },
  { tipo: "cobro", etiqueta: "Cobrar trabajo", Icono: Banknote },
] as const;

export function AccionesFab({
  /** Destino de Cancelar/volver del wizard que se abra desde acá. */
  volverA,
}: {
  volverA: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const contRef = useRef<HTMLDivElement>(null);
  // `useTap` y no `onClick`: en iOS el toque puede no generar `click` (§119).
  const tap = useTap(() => setAbierto((a) => !a));

  // Cierra al tocar fuera (mismo patrón que el menú ⋯) o con Escape.
  useEffect(() => {
    if (!abierto) return;
    const onDown = (e: MouseEvent) => {
      if (contRef.current && !contRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [abierto]);

  return (
    <div
      ref={contRef}
      data-fab-acciones
      className="fp-fab-acciones pointer-events-none fixed z-40 flex flex-col items-end gap-2"
    >
      {abierto && (
        <div className="fp-dial-in flex flex-col items-end gap-2">
          {ACCIONES.map(({ tipo, etiqueta, Icono }) => (
            <Link
              key={tipo}
              href={`/movimientos/nuevo/${tipo}?volverA=${encodeURIComponent(volverA)}`}
              onClick={() => setAbierto(false)}
              className={cn(
                "pointer-events-auto flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium shadow-xl transition-colors",
                // ⚠️ Fondo **`bg-muted` (opaco)**: con el tinte `bg-success/10` el
                // monto de la fila de la grilla **se veía a través** de la píldora
                // (reportado por el usuario 2026-09-26). Además `bg-muted` es más
                // oscuro que el `bg-card` de la grilla ⇒ la píldora se despega.
                tipo === "cobro"
                  ? "border-success/60 bg-muted text-success hover:bg-card"
                  : "border-border bg-muted text-card-foreground hover:bg-card"
              )}
            >
              <Icono className="h-4 w-4" />
              {etiqueta}
              <LinkNavStatus />
            </Link>
          ))}
        </div>
      )}

      <button
        type="button"
        {...tap}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Cargar o cobrar trabajo"
        title="Cargar o cobrar trabajo"
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-header text-background shadow-lg transition-transform active:scale-95"
      >
        <Plus
          className={cn(
            "h-6 w-6 transition-transform duration-150",
            abierto && "rotate-45"
          )}
        />
      </button>
    </div>
  );
}
