"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Acción revelada por el menú deslizante de una fila. */
export interface SwipeRowAction {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}

interface SwipeRowActionsProps {
  /** Contenido que envuelve la grilla (típicamente el card con el `<table>`). */
  children: React.ReactNode;
  /** Acciones de la fila con ese id (`null`/`[]` = la fila no tiene menú). */
  actionsFor?: (rowId: string) => SwipeRowAction[] | null;
  /** Toque simple sobre una fila (un swipe NO lo dispara). */
  onRowTap?: (rowId: string) => void;
  /** Ancho de la franja revelada, en px (default 148). */
  width?: number;
}

/** Recorrido mínimo antes de decidir si el gesto es horizontal (menú) o
    vertical (scroll de la grilla). */
const DECIDE_PX = 8;
/** Proporción del ancho revelado para que el menú quede ABIERTO al soltar. */
const OPEN_RATIO = 0.4;
/** Estiramiento extra al arrastrar más allá del ancho (efecto goma). */
const RUBBER = 24;
/** Duración de la animación de apertura/cierre (ms). */
const ANIM_MS = 180;
/** Duración máxima de un gesto para considerarlo un TOQUE (ms). */
const TAP_MS = 500;
/** Zona de inicio del gesto, medida desde el BORDE DERECHO VISIBLE de la grilla
    (el de la tarjeta/wrapper), en px. Si el dedo empieza más a la izquierda, el
    arrastre horizontal es SIEMPRE scroll de la grilla: el menú solo reacciona si
    el gesto arranca cerca del borde derecho (decisión del usuario 2026-09-13). */
const EDGE_ZONE_PX = 72;

/**
 * Primer ancestro de `el` (sin pasar de `limite`) que pueda scrollear
 * HORIZONTALMENTE. La grilla mobile de `DataTable` ya trae su propio
 * `overflow-x-auto`: en pantallas donde las columnas no entran hay que dejarlo
 * scrollear con el dedo en vez de robárselo para el menú.
 */
function findScrollerX(
  el: HTMLElement | null,
  limite: HTMLElement | null
): HTMLElement | null {
  let n: HTMLElement | null = el;
  while (n && n !== limite) {
    if (n.scrollWidth > n.clientWidth + 1) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === "auto" || ox === "scroll") return n;
    }
    n = n.parentElement;
  }
  return null;
}

/**
 * Menú deslizante por fila (estilo WhatsApp) para las grillas mobile.
 *
 * - Se envuelve la grilla: el componente agrega el contenedor `relative` y pinta
 *   una franja de acciones anclada al borde DERECHO de la fila. Al arrastrar la
 *   fila hacia la IZQUIERDA la franja se va revelando; al pasar el umbral queda
 *   abierta y si no, vuelve sola.
 * - ⚠️ **Gestos con TOUCH events** (`touchstart`/`touchmove`/`touchend`) y NO con
 *   Pointer Events: con `touch-action` (o `auto`) el navegador decide el gesto y
 *   **cancela los pointer events** (`pointercancel`) al primer `touchmove`, así
 *   que el menú NUNCA abría en un celular real (verificado enviando touches con
 *   `Input.dispatchTouchEvent`). Con touch events + `preventDefault()` (listener
 *   `{ passive: false }`, igual que `pull-to-refresh.tsx`) el gesto horizontal es
 *   NUESTRO y el vertical queda para el scroll (ahí no se llama `preventDefault`).
 * - El **mouse** sí usa Pointer Events (`pointerType === "mouse"`), así el menú
 *   también se puede usar/probar en una ventana angosta.
 * - ⚠️ Regla del gesto horizontal (decisión del usuario 2026-09-13):
 *   · **Arranca a <= `EDGE_ZONE_PX` del BORDE DERECHO VISIBLE de la grilla** → es
 *     el MENÚ: la fila se va desplazando y revela las acciones.
 *   · **Arranca más a la izquierda** → es horizontal SCROLL de la grilla (si la
 *     grilla puede desplazarse; si no, el gesto no hace nada). El menú NO se
 *     abre nunca desde el medio de la fila.
 *   Por eso el wrapper usa `touch-action: pan-y pinch-zoom`: el navegador nunca
 *   panea en horizontal (el scroll lo hacemos nosotros) y el vertical queda para
 *   la página.
 * - **Mover la fila de forma IMPERATIVA** (`ref` + `style.transform` /
 *   `style.width` en cada move, sin re-render), igual que el pull-to-refresh.
 * - El elemento arrastrado se ubica por `data-row-id` (atributo que agrega
 *   `DataTable` a cada `<tr>`); las acciones se piden con ese id.
 *
 * ⚠️ Colores: PROVISIONAL en rojo (`bg-danger`), pedido del usuario 2026-09-13.
 */

export function SwipeRowActions({
  children,
  actionsFor,
  onRowTap,
  width = 148,
}: SwipeRowActionsProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  /** Fila que se está arrastrando ahora mismo. */
  const rowRef = useRef<HTMLTableRowElement | null>(null);
  /** Fila con el menú ABIERTO (para poder cerrarla). */
  const openRowRef = useRef<HTMLTableRowElement | null>(null);
  const openIdRef = useRef<string | null>(null);
  /** Último desplazamiento pintado (px). */
  const lastDRef = useRef(0);
  const startRef = useRef({
    x: 0,
    y: 0,
    t: 0,
    base: 0,
    /** scrollLeft de la grilla al empezar el gesto (para el scroll imperativo). */
    scrollBase: 0,
    /** El gesto arrancó en la zona de borde derecho → es el MENÚ (si no, scroll). */
    edge: false,
    axis: null as null | "x" | "y",
    moved: false,
    id: "",
  });
  /** Datos de la franja visible (id + acciones + geometría de la fila). */
  const [menu, setMenu] = useState<{
    id: string;
    actions: SwipeRowAction[];
    top: number;
    height: number;
    right: number;
  } | null>(null);
  /** El gesto en curso empezó DENTRO de la franja de acciones. */
  const fromStripRef = useRef(false);
  /** Contenedor con scroll horizontal de la grilla (si lo hay) al empezar. */
  const scrollerXRef = useRef<HTMLElement | null>(null);

  // Callbacks/valor SIEMPRE frescos: los listeners nativos se registran una sola
  // vez (como en el pull-to-refresh) y leen de acá.
  const cbRef = useRef({ actionsFor, onRowTap, width });
  useEffect(() => {
    cbRef.current = { actionsFor, onRowTap, width };
  });

  const paintStrip = useCallback((px: number) => {
    if (stripRef.current) stripRef.current.style.width = `${px}px`;
  }, []);

  const paintRow = useCallback((px: number) => {
    if (rowRef.current) {
      rowRef.current.style.transform = px ? `translateX(${-px}px)` : "";
    }
  }, []);

  /** Cierra el menú abierto (vuelve la fila a su lugar). */
  const closeOpen = useCallback(() => {
    const r = openRowRef.current;
    if (r) {
      r.style.transition = "";
      r.style.transform = "";
    }
    openRowRef.current = null;
    openIdRef.current = null;
    lastDRef.current = 0;
  }, []);

  // La franja se monta al empezar el gesto: acá se la deja en el ancho que
  // corresponde (0 si la fila estaba cerrada, `width` si ya estaba abierta).
  useLayoutEffect(() => {
    if (menu) paintStrip(startRef.current.base);
  }, [menu, paintStrip]);

  /** Empieza un gesto sobre `target` (touch o mouse). */
  const startDrag = useCallback(
    (target: HTMLElement, clientX: number, clientY: number) => {
    // ⚠️ Los gestos DENTRO de la franja se ignoran por completo: si el menú se
    // cierra, el botón se desmonta antes del `click` y la acción no se ejecuta.
    fromStripRef.current = !!stripRef.current?.contains(target);
    if (fromStripRef.current) return;
    // Hasta que se confirme que la fila tiene acciones, el gesto no es de nadie
    // (así un toque en otra parte no dispara la navegación de la fila anterior).
    startRef.current.id = "";
    scrollerXRef.current = findScrollerX(target, wrapRef.current);
    const tr = target.closest<HTMLTableRowElement>("tr[data-row-id]");
    // Toque fuera de las filas (padding del card, franja abierta, etc.).
    if (!tr) {
      if (openIdRef.current) {
        closeOpen();
        setMenu(null);
      }
      return;
    }
    const id = tr.getAttribute("data-row-id") ?? "";
    const actions = cbRef.current.actionsFor?.(id);
    const wrapRect = wrapRef.current?.getBoundingClientRect();
    if (!actions || actions.length === 0 || !wrapRect) {
      if (openIdRef.current) {
        closeOpen();
        setMenu(null);
      }
      return;
    }
    // Otra fila abierta: se cierra (sin animación, la nueva toma su lugar).
    if (openIdRef.current && openIdRef.current !== id) closeOpen();

    const rect = tr.getBoundingClientRect();
    tr.style.transition = "";
    if (stripRef.current) stripRef.current.style.transition = "";
    rowRef.current = tr;
    const base = openIdRef.current === id ? cbRef.current.width : 0;
    lastDRef.current = base;
    startRef.current = {
      x: clientX,
      y: clientY,
      t: Date.now(),
      base,
      scrollBase: scrollerXRef.current?.scrollLeft ?? 0,
      // ¿Arranca cerca del borde DERECHO VISIBLE (el de la tarjeta/wrapper)? Se
      // mide contra el wrapper y no contra el borde de la fila porque, cuando la
      // grilla desborda el ancho de la tarjeta, el extremo de la fila queda FUERA
      // (ahi el toque ni siquiera llega a este componente).
      edge: wrapRect.right - clientX <= EDGE_ZONE_PX,
      axis: null,
      moved: false,
      id,
    };
    setMenu({
      id,
      actions,
      top: rect.top - wrapRect.top,
      height: rect.height,
      // Anclada al borde DERECHO de la fila; si la grilla desbordara la tarjeta,
      // se la clava al borde VISIBLE para que las acciones nunca queden fuera.
      right: Math.max(0, wrapRect.right - rect.right),
    });
    },
    [closeOpen]
  );

  /** Mueve el gesto en curso. Devuelve true si el gesto es NUESTRO (horizontal). */
  const moveDrag = useCallback(
    (clientX: number, clientY: number) => {
      if (fromStripRef.current) return false;
      const st = startRef.current;
      const row = rowRef.current;
      if (!row || !st.id) return false;
      const dx = clientX - st.x;
      const dy = clientY - st.y;

      if (!st.axis) {
        if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) return false;
        // Gesto VERTICAL = scroll de la PÁGINA: se suelta el menú y no frenamos
        // el gesto (lo maneja el navegador).
        if (Math.abs(dy) > Math.abs(dx)) {
          st.axis = "y";
          row.style.transition = "";
          row.style.transform = "";
          rowRef.current = null;
          closeOpen();
          setMenu(null);
          return false;
        }
        st.axis = "x";
      }

      // ¿La grilla todavía puede desplazarse en la dirección del swipe?
      const sc = scrollerXRef.current;
      const puedeScroll =
        !!sc &&
        (dx < 0
          ? sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 1
          : sc.scrollLeft > 0);

      // Gesto arrancado LEJOS del borde derecho: SIEMPRE scroll de la grilla
      // (el menú no reacciona desde el medio de la fila).
      if (!st.edge) {
        if (sc && puedeScroll) {
          sc.scrollLeft = st.scrollBase - dx;
          return true;
        }
        // Sin scroll horizontal disponible: el gesto no hace nada.
        st.axis = "y";
        row.style.transition = "";
        row.style.transform = "";
        rowRef.current = null;
        closeOpen();
        setMenu(null);
        return false;
      }

      // Si venimos de estar scrolleando, la franja quedó anclada a la geometría
      // de ANTES del scroll: se re-ancla a la posición actual de la fila.
      if (!st.moved && stripRef.current) {
        const rect = row.getBoundingClientRect();
        const wrapRect = wrapRef.current?.getBoundingClientRect();
        if (wrapRect) {
          stripRef.current.style.top = `${rect.top - wrapRect.top}px`;
          stripRef.current.style.height = `${rect.height}px`;
          stripRef.current.style.right = `${Math.max(
            0,
            wrapRect.right - rect.right
          )}px`;
        }
      }

      // Zona de borde: MENÚ de la fila (reveal progresivo).
      st.moved = true;
      const w = cbRef.current.width;
      // dx < 0 al deslizar hacia la izquierda (el desplazamiento revelado crece).
      const d = Math.max(0, Math.min(st.base - dx, w + RUBBER));
      lastDRef.current = d;
      paintRow(d);
      paintStrip(Math.min(d, w));
      return true;
    },
    [closeOpen, paintRow, paintStrip]
  );

  /** Termina el gesto en curso (`isCancel` = el navegador lo canceló). */
  const endDrag = useCallback(
    (isCancel: boolean) => {
    if (fromStripRef.current) {
      fromStripRef.current = false;
      return;
    }
    const st = startRef.current;
    const row = rowRef.current;
    rowRef.current = null;
    // El gesto no empezó en una fila con acciones.
    if (!st.id) return;
    const w = cbRef.current.width;

    // Arrastre horizontal terminado normalmente: abrir o volver.
    if (row && st.axis === "x" && st.moved && !isCancel) {
      const abrir = lastDRef.current > w * OPEN_RATIO;
      if (stripRef.current) {
        stripRef.current.style.transition = `width ${ANIM_MS}ms ease-out`;
      }
      row.style.transition = `transform ${ANIM_MS}ms ease-out`;
      if (abrir) {
        row.style.transform = `translateX(${-w}px)`;
        openRowRef.current = row;
        openIdRef.current = st.id;
        lastDRef.current = w;
        paintStrip(w);
      } else {
        row.style.transform = "";
        lastDRef.current = 0;
        paintStrip(0);
        window.setTimeout(() => setMenu(null), ANIM_MS);
      }
      return;
    }

    // Gesto cancelado a mitad de camino (p. ej. el navegador tomó el scroll).
    if (row && (isCancel || st.axis === "x")) {
      row.style.transform = "";
      closeOpen();
      setMenu(null);
      return;
    }

    // TOQUE (sin desplazamiento decidido): si había un menú abierto se cierra;
    // si no, se navega.
    const esToque = !isCancel && st.axis === null && Date.now() - st.t < TAP_MS;
    const habiaAbierto = openIdRef.current !== null;
    if (habiaAbierto) closeOpen();
    setMenu(null);
    if (esToque && !habiaAbierto) cbRef.current.onRowTap?.(st.id);
    },
    [closeOpen, paintStrip]
  );

  // Listeners NATIVOS de touch, registrados UNA sola vez (los handlers son
  // estables: `useCallback` con deps estables + refs). `touchmove` va con
  // `{ passive: false }` para poder frenar el scroll cuando el gesto es nuestro
  // (mismo patrón que `pull-to-refresh.tsx`).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) startDrag(e.target as HTMLElement, t.clientX, t.clientY);
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (moveDrag(t.clientX, t.clientY)) e.preventDefault();
    };
    const onEnd = () => endDrag(false);
    const onCancel = () => endDrag(true);
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onCancel);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [startDrag, moveDrag, endDrag]);

  // El mouse usa Pointer Events (con mouse no hay gesto de scroll que cancelar).
  // Los pointer events de un TOUCH se ignoran: de esos se ocupan los touch
  // listeners de arriba.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    startDrag(e.target as HTMLElement, e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    moveDrag(e.clientX, e.clientY);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    endDrag(false);
  };

  return (
    <div
      ref={wrapRef}
      // `touch-action: pan-y` = el navegador NUNCA panea en horizontal (el scroll
      // horizontal de la grilla lo hacemos nosotros, ver `moveDrag`); el scroll
      // vertical de la página queda nativo. `pinch-zoom` mantiene el zoom.
      className="relative [touch-action:pan-y_pinch-zoom]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {children}

      {/* Franja de acciones, anclada al borde derecho de la fila activa. El
          ancho se pinta de forma imperativa (0 = tapada por la fila). */}
      {menu && (
        <div
          key={menu.id}
          ref={stripRef}
          style={{ top: menu.top, height: menu.height, right: menu.right }}
          className="absolute z-10 w-0 overflow-hidden"
        >
          <div className="ml-auto flex h-full" style={{ width }}>
            {menu.actions.map((a, i) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => {
                    closeOpen();
                    setMenu(null);
                    a.onClick();
                  }}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-0.5 bg-danger px-0.5 text-center text-[10.5px] leading-tight font-medium text-white",
                    i > 0 && "border-l border-black/20"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
