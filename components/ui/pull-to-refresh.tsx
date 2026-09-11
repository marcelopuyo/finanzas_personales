"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Tirar para actualizar" (pull-to-refresh) estilo iOS para la app.
 *
 * - Es el contenedor que SCROLLEA (`<main>` en `app-layout.tsx`): el gesto se
 *   escucha acá (no en `window`) porque el documento no scrollea en esta app.
 * - Al tirar hacia abajo con el scroll ARRIBA de todo, el contenido se
 *   estira con resistencia y aparece el indicador en el hueco que se abre:
 *   el ícono gira a medida que se tira y al pasar el umbral se dispara
 *   `router.refresh()` (re-ejecuta los Server Components y trae datos frescos
 *   SIN perder estado de cliente: pestañas, filtros, scroll, pasos del wizard).
 * - El PTR nativo del navegador queda desactivado (`overscroll-behavior-y:
 *   none` en `globals.css`) para que no compitan los dos gestos.
 *
 * Detalles de implementación:
 * - El estiramiento se pinta de forma IMPERATIVA (refs + `style.transform`)
 *   para no re-renderizar en cada `touchmove`.
 * - `touchmove` se registra con `{ passive: false }` para poder frenar el
 *   scroll y el "rubber-band" nativo mientras dura el pull.
 * - No se activa si: el scroll no está arriba, hay un modal abierto
 *   (`[role="dialog"]`, que vive dentro del scroll y burbujearía hasta acá) o
 *   el gesto es más horizontal que vertical (stepper/wizard).
 */

/** Distancia (px, ya amortiguada) necesaria para disparar el refresco. */
const THRESHOLD = 64;
/** Tope de estiramiento: más allá de esto el contenido no sigue bajando. */
const MAX_PULL = 96;
/** Resistencia: el contenido se mueve la mitad de lo que arrastra el dedo. */
const RESISTANCE = 0.5;
/** Mínimo que se ve el spinner una vez terminado el refresh (comodidad). */
const MIN_SPIN_MS = 400;
/** Corte de seguridad si el transition quedara colgado. */
const MAX_SPIN_MS = 8000;
/** Recorrido del gesto antes de decidir que es un pull vertical. */
const DECIDE_PX = 4;

interface PullToRefreshProps {
  children: React.ReactNode;
  /** Clases del contenedor que scrollea (padding/layout; en la app: las que
      tenía el `<main>`). El componente agrega `relative` y `overscroll-none`. */
  className?: string;
}

export function PullToRefresh({ children, className }: PullToRefreshProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  const start = useRef<{ x: number; y: number } | null>(null);
  /** null = sin decidir · true = pull vertical activo. */
  const pulling = useRef<boolean | null>(null);
  /** Estiramiento actual (px ya amortiguados). */
  const pulled = useRef(0);

  const [refreshing, setRefreshing] = useState(false);
  const [pending, startTransition] = useTransition();
  const spinning = refreshing || pending;

  /** Pinta el estiramiento (imperativo, sin re-render). */
  const paint = useCallback(
    (dy: number, animate = false) => {
      pulled.current = dy;
      const content = contentRef.current;
      if (content) {
        if (dy === 0) {
          // ⚠️ En REPOSO el transform se ELIMINA: un ancestro con `transform`
          // (o `will-change: transform`) pasa a ser containing block de los
          // `position: fixed` de adentro → modales, overlay y tooltips de los
          // gráficos quedarían mal posicionados. Solo se transforma mientras
          // dura el gesto (y ahí no hay nada fijo abierto).
          if (animate) {
            content.style.transition =
              "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)";
            content.style.transform = "translateY(0px)";
            window.setTimeout(() => {
              if (pulled.current !== 0) return; // empezó otro pull
              content.style.transition = "";
              content.style.transform = "";
              content.style.willChange = "";
            }, 280);
          } else {
            content.style.transition = "";
            content.style.transform = "";
            content.style.willChange = "";
          }
        } else {
          content.style.transition = "none";
          content.style.willChange = "transform";
          content.style.transform = `translateY(${dy}px)`;
        }
      }
      const progress = Math.min(1, dy / THRESHOLD);
      if (badgeRef.current) badgeRef.current.style.opacity = String(progress);
      if (iconRef.current && !spinning) {
        iconRef.current.style.transform = `rotate(${progress * 180}deg)`;
      }
    },
    [spinning]
  );

  /** Dispara el refresco: transition + `router.refresh()` (RSC de la ruta). */
  const trigger = useCallback(() => {
    // Se limpia el giro "manual" del pull: el ícono pasa a girar con la
    // animación CSS (`animate-spin`), que arranca desde 0 y no da saltos.
    if (iconRef.current) iconRef.current.style.transform = "";
    setRefreshing(true);
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  // Gesto. El efecto se re-registra al terminar un refresh para no capturar
  // estado viejo (`spinning`, `paint`) en los listeners.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || spinning) return;

    const onStart = (e: TouchEvent) => {
      // Solo desde el tope y sin modales abiertos.
      if (el.scrollTop > 0 || document.querySelector('[role="dialog"]')) {
        start.current = null;
        pulling.current = null;
        return;
      }
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      pulling.current = null;
    };

    const onMove = (e: TouchEvent) => {
      const s = start.current;
      if (!s) return;
      const dy = e.touches[0].clientY - s.y;
      const dx = e.touches[0].clientX - s.x;

      if (pulling.current === null) {
        // Gesto horizontal (stepper, carruseles): no es un pull.
        if (Math.abs(dx) > Math.abs(dy)) {
          start.current = null;
          return;
        }
        if (dy < DECIDE_PX) return;
        pulling.current = true;
      }

      if (dy <= 0) {
        paint(0);
        return;
      }
      // Frena el scroll/rubber-band nativo: el gesto es nuestro.
      e.preventDefault();
      paint(Math.min(MAX_PULL, dy * RESISTANCE));
    };

    const onEnd = () => {
      const wasPulling = pulling.current === true;
      start.current = null;
      pulling.current = null;
      if (!wasPulling) return;
      if (pulled.current >= THRESHOLD) trigger();
      else paint(0, true);
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [spinning, paint, trigger]);

  // Fin del refresco: se espera a que el transition deje de estar pendiente
  // (más un mínimo con el spinner a la vista) y el contenido vuelve solo.
  useEffect(() => {
    if (!refreshing) return;
    const t = setTimeout(
      () => {
        paint(0, true);
        setRefreshing(false);
      },
      pending ? MAX_SPIN_MS : MIN_SPIN_MS
    );
    return () => clearTimeout(t);
  }, [refreshing, pending, paint]);

  return (
    <main
      ref={scrollRef}
      className={cn("relative h-full overflow-y-auto overscroll-none", className)}
    >
      <div ref={contentRef} className="relative">
        {/* Indicador (se revela en el hueco que abre el tirón, como en iOS). */}
        <div
          ref={badgeRef}
          aria-hidden
          className="pointer-events-none absolute -top-11 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center text-subtitle opacity-0"
        >
          <div ref={iconRef} className={cn(spinning && "animate-spin")}>
            <RefreshCw className="h-5 w-5" />
          </div>
        </div>
        {children}
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {spinning ? "Actualizando…" : ""}
      </span>
    </main>
  );
}
