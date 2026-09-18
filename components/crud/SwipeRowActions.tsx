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

/** Color del círculo de una acción del menú deslizante (ver `TONE_BG`). */
export type SwipeTone = "neutral" | "primary" | "success" | "danger" | "warning";

/** Acción revelada por el menú deslizante de una fila. */
export interface SwipeRowAction {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Color del círculo. Si se omite, se deduce de `key` (ver `toneDe`):
      `delete` → rojo · `cobrar`/`pagar` → verde · cualquier otra → gris. */
  tone?: SwipeTone;
  /** Botón ANCHO en vez de círculo: una PÍLDORA que ocupa todo el ancho de su
      acción (el ícono queda centrado). Lo usa la acción EXTRA/principal de la
      fila —Cobrar, Nueva jornada, Nueva tarea— para destacarse del resto
      (decisión del usuario 2026-09-17, como el botón verde de la captura de
      referencia). El ALTO es el mismo que el del círculo. */
  wide?: boolean;
}

interface SwipeRowActionsProps {
  /** Contenido que envuelve la grilla (típicamente el card con el `<table>`). */
  children: React.ReactNode;
  /** Acciones de la fila con ese id (`null`/`[]` = la fila no tiene menú). */
  actionsFor?: (rowId: string) => SwipeRowAction[] | null;
  /** Toque simple sobre una fila (un swipe NO lo dispara). */
  onRowTap?: (rowId: string) => void;
}

/** Recorrido mínimo antes de decidir si el gesto es horizontal (menú) o
    vertical (scroll de la grilla). */
const DECIDE_PX = 8;
/** Proporción del ancho revelado para que el menú quede ABIERTO al soltar. */
const OPEN_RATIO = 0.4;
/** Estiramiento extra al arrastrar más allá del ancho (efecto goma). */
const RUBBER = 24;
/** Duración de la animación de apertura/cierre (ms). */
const ANIM_MS = 200;
/** Curva de apertura/cierre: arranca decidida y FRENA suave (el cierre tiene
    que verse gradual, no cortado en seco). */
const ANIM_EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";
/** Duración máxima de un gesto para considerarlo un TOQUE (ms). */
const TAP_MS = 500;
/** Zona de inicio del gesto, medida desde el BORDE DERECHO VISIBLE de la grilla
    (el de la tarjeta/wrapper), en px. Si el dedo empieza más a la izquierda, el
    arrastre horizontal es SIEMPRE scroll de la grilla: el menú solo reacciona si
    el gesto arranca cerca del borde derecho (decisión del usuario 2026-09-13). */
const EDGE_ZONE_PX = 72;
/** Ancho MÍNIMO de una acción (px): el del círculo más corto. */
const ITEM_MIN_W = 64;
/** Ancho MÁXIMO de una acción (px): deja entrar ~20 caracteres en una línea; una
    etiqueta más larga se parte en 2 y la franja crece (`stripHeight`). */
const ITEM_MAX_W = 112;
/** Ancho por acción de la ESTIMACIÓN inicial (px): se usa solo al empezar el
    gesto, antes de montar la franja y medir el ancho real de las etiquetas. */
const ITEM_EST_W = 74;
/** Alto MÍNIMO de la franja (px): el que necesita el contenido cuando TODAS las
    etiquetas entran en una línea (círculo + aire + etiqueta). */
const STRIP_MIN_H = 56;
/** Alto del círculo/píldora, en px (`h-10`). */
const CIRCLE_H = 40;
/** Separación entre el círculo/píldora y su etiqueta, en px (`gap-0.5`). */
const LABEL_GAP = 2;
/** Aire arriba y abajo del contenido dentro de la franja, en px (1px por lado). */
const STRIP_PAD = 2;
/** Fondo del círculo de cada acción (estética del swipe del Mail de iOS: un
    CÍRCULO de color con el ícono adentro y la etiqueta debajo, sobre el fondo de
    la tarjeta). */
const TONE_BG: Record<SwipeTone, string> = {
  neutral: "bg-subtitle",
  primary: "bg-primary",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-amber-500",
};

/** Color por defecto de una acción según su `key` (una acción puede pisarlo con
    `tone`). */
function toneDe(key: string): SwipeTone {
  if (key === "delete") return "danger";
  if (key === "cobrar" || key === "pagar") return "success";
  return "neutral";
}

/** Estiraje AL ESTIMAR el alto de la franja (px arriba y abajo): la fila o, si
    es más baja, `STRIP_MIN_H`. Al montarse, `stripHeight` ajusta el alto al
    contenido REAL medido. */
function stripExtra(rowHeight: number): number {
  return (Math.max(rowHeight, STRIP_MIN_H) - rowHeight) / 2;
}

/**
 * Alto REAL que necesita la franja (px), medido sobre la franja ya montada: el
 * mayor entre la fila, `STRIP_MIN_H` y el contenido (círculo/píldora + etiqueta
 * más alta).
 *
 * ⚠️ Se MIDE la etiqueta en vez de suponer una línea: en un celular real la
 * fuente del sistema es más ancha y "Nueva jornada" cae en 2 líneas ⇒ con el
 * alto fijo el contenido se recortaba/empujaba la píldora fuera de la fila
 * (bug reportado por el usuario 2026-09-17).
 */
function stripHeight(strip: HTMLElement, rowHeight: number): number {
  let maxLabel = 0;
  strip.querySelectorAll<HTMLElement>("[data-swipe-label]").forEach((el) => {
    maxLabel = Math.max(maxLabel, el.offsetHeight);
  });
  return Math.max(
    rowHeight,
    STRIP_MIN_H,
    CIRCLE_H + LABEL_GAP + maxLabel + STRIP_PAD
  );
}

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
 *   · **Excepción — la fila arrastrada es la que YA tiene el menú ABIERTO**
 *     (decisión del usuario 2026-09-16): el desplazamiento horizontal es
 *     SIEMPRE del MENÚ (arrastrar a la DERECHA lo cierra de forma gradual), sin
 *     importar dónde empezó el dedo. Con el menú abierto la fila está corrida
 *     `width` px hacia la izquierda, así que la zona de borde queda TAPADA por
 *     la propia franja y el gesto de cerrar arranca muy seguido sobre la fila
 *     (antes ese arrastre caía en la rama de "scroll" y el menú se cerraba de
 *     golpe).
 *   · **El gesto arrancó DENTRO de la franja de acciones** (mismo día): un
 *     desplazamiento HORIZONTAL también cierra el menú (el gesto se "promueve" a
 *     un arrastre de la fila abierta); sin movimiento el gesto sigue siendo el
 *     `click` del botón (y si el gesto se movió, ese `click` se descarta, ver
 *     `stripDragRef`).
 *   Por eso el wrapper usa `touch-action: pan-y pinch-zoom`: el navegador nunca
 *   panea en horizontal (el scroll lo hacemos nosotros) y el vertical queda para
 *   la página.
 * - ⚠️ **Cierre ANIMADO (decisión del usuario 2026-09-16)**: TODOS los cierres
 *   (soltar el gesto, toque sobre la fila, toque afuera de las filas, scroll
 *   vertical que se lleva el gesto, swipe sobre la franja, clic en una acción)
 *   pasan por `animateClose`: la fila vuelve con `transition: transform` y la
 *   franja se ANGOSTA a 0 en el mismo tiempo (la franja se desmonta al terminar).
 *   Antes el cierre era instantáneo (`transition`/`transform` en blanco) y se
 *   veía cortado en seco.
 * - **Mover la fila de forma IMPERATIVA** (`ref` + `style.transform` /
 *   `style.width` en cada move, sin re-render), igual que el pull-to-refresh.
 * - El elemento arrastrado se ubica por `data-row-id` (atributo que agrega
 *   `DataTable` a cada `<tr>`); las acciones se piden con ese id.
 *
 * ⚠️ Estética (pedido del usuario 2026-09-17: *"como el swipe del Mail de
 * iOS"*): cada acción es un **CÍRCULO de color con el ícono adentro y su
 * etiqueta debajo**, sobre el fondo de la tarjeta (`bg-card`) — ya NO la franja
 * maciza `bg-primary` con texto blanco del 2026-09-16 (histórico: `bg-danger`
 * del 2026-09-13). El color sale de `SwipeRowAction.tone`, con `toneDe(key)`
 * como default: Eliminar rojo · Cobrar/pagar verde · el resto gris. En el CRUD
 * de períodos la acción EXTRA (Cobrar / Nueva jornada / Nueva tarea) va **verde**
 * y Editar **azul** (los fija la vista y `CrudTable`).
 * - **Cada acción se ensancha según su ETIQUETA** (decisión del usuario
 *   2026-09-17): el contenedor de acciones es `w-max` y cada acción es
 *   `flex-none` con `minWidth`/`maxWidth` (`ITEM_MIN_W`/`ITEM_MAX_W`), así el
 *   navegador le da a cada una el ancho de su etiqueta ("Nueva jornada" queda más
 *   ancha que "Editar"/"Eliminar", como el botón verde de la captura) y **la
 *   etiqueta nunca se parte**: la franja queda en `STRIP_MIN_H` = **56px**. El
 *   ancho total (la suma) se MIDE al montar y se guarda en `widthRef` para el
 *   umbral de apertura y el revelado (al empezar el gesto se usa `ITEM_EST_W`).
 * - La franja se **centra verticalmente** sobre la fila y su alto también se
 *   **MIDE** al montarse (`stripHeight`): si una etiqueta llegara a partirse en 2
 *   líneas (solo con una etiqueta más larga que `ITEM_MAX_W`), la franja crece y
 *   **tapa con `bg-card` lo que quede detrás**.
 * - Tamaños: círculo 40px + ícono 20px + etiqueta 10px (`leading-3`), las
 *   proporciones de la captura de referencia.
 * - La acción marcada con `wide` (la EXTRA de la fila: Cobrar / Nueva jornada /
 *   Nueva tarea) no es un círculo sino una **PÍLDORA** del mismo alto que ocupa
 *   todo el ancho de su acción, como el botón verde de la captura.
 */

export function SwipeRowActions({
  children,
  actionsFor,
  onRowTap,
}: SwipeRowActionsProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  /** Contenedor de las acciones dentro de la franja (ancho intrínseco). */
  const innerRef = useRef<HTMLDivElement>(null);
  /** Fila que se está arrastrando ahora mismo. */
  const rowRef = useRef<HTMLTableRowElement | null>(null);
  /** Fila con el menú ABIERTO (para poder cerrarla). */
  const openRowRef = useRef<HTMLTableRowElement | null>(null);
  const openIdRef = useRef<string | null>(null);
  /** Último desplazamiento pintado (px). */
  const lastDRef = useRef(0);
  /** Ancho TOTAL de la franja ACTIVA (px): la ESTIMACIÓN al empezar el gesto y,
      apenas se monta la franja, el ancho REAL medido de las acciones (suma de los
      anchos que el navegador les da según sus etiquetas). */
  const widthRef = useRef(0);
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
    /** Borde superior de la FILA, relativo al wrapper (px). */
    rowTop: number;
    /** Alto de la FILA (px). */
    rowH: number;
    right: number;
  } | null>(null);
  /** El gesto en curso empezó DENTRO de la franja de acciones. */
  const fromStripRef = useRef(false);
  /** Punto de partida de un gesto empezado DENTRO de la franja (candidato a
      toque de un botón o a arrastre que cierra el menú, ver `moveDrag`). */
  const stripStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  /** El último gesto sobre la franja se resolvió como ARRASTRE: el `click` que
      dispare el navegador al soltar se ignora (si no, cerrar el menú con un
      swipe sobre la franja ejecutaría el botón). */
  const stripDragRef = useRef(false);
  /** Contenedor con scroll horizontal de la grilla (si lo hay) al empezar. */
  const scrollerXRef = useRef<HTMLElement | null>(null);

  // Callbacks/valor SIEMPRE frescos: los listeners nativos se registran una sola
  // vez (como en el pull-to-refresh) y leen de acá.
  const cbRef = useRef({ actionsFor, onRowTap });
  useEffect(() => {
    cbRef.current = { actionsFor, onRowTap };
  });

  const paintStrip = useCallback((px: number) => {
    if (stripRef.current) stripRef.current.style.width = `${px}px`;
  }, []);

  const paintRow = useCallback((px: number) => {
    if (rowRef.current) {
      rowRef.current.style.transform = px ? `translateX(${-px}px)` : "";
    }
  }, []);

  /**
   * Cierra `row` CON ANIMACIÓN: la fila vuelve a su lugar y la franja se angosta
   * a 0 en el mismo tiempo (si la franja no acompañara, la fila taparía las
   * acciones de golpe). La franja se desmonta recién al terminar la animación —y
   * solo si sigue siendo la de ESTA fila (otra fila pudo haber tomado el menú
   * entretanto).
   */
  const animateClose = useCallback(
    (row: HTMLTableRowElement, id: string) => {
      row.style.transition = `transform ${ANIM_MS}ms ${ANIM_EASE}`;
      row.style.transform = "";
      if (stripRef.current) {
        stripRef.current.style.transition = `width ${ANIM_MS}ms ${ANIM_EASE}`;
        paintStrip(0);
      }
      window.setTimeout(() => {
        setMenu((m) => (m && m.id === id ? null : m));
      }, ANIM_MS);
    },
    [paintStrip]
  );

  /** Cierra el menú abierto (vuelve la fila a su lugar). `instant` = sin
      animación, para cuando la fila se reutiliza enseguida (otra fila toma el
      menú y dos franjas moviéndose a la vez se verían mal). */
  const closeOpen = useCallback(
    (instant = false) => {
      const r = openRowRef.current;
      const id = openIdRef.current;
      openRowRef.current = null;
      openIdRef.current = null;
      lastDRef.current = 0;
      if (!r) return;
      if (instant || !id) {
        r.style.transition = "";
        r.style.transform = "";
        setMenu(null);
        return;
      }
      animateClose(r, id);
    },
    [animateClose]
  );

  // La franja se monta al empezar el gesto: acá se la deja en el ancho que
  // corresponde (0 si la fila estaba cerrada, el ancho total si ya estaba
  // abierta) y se la ancla sobre la fila con el ALTO que necesita el contenido ya
  // renderizado. Además se MIDE el ancho REAL de las acciones (el navegador se lo
  // da a cada una según su etiqueta) y se reemplaza la estimación de `startDrag`,
  // así el umbral de apertura y el ancho revelado quedan exactos. Va en
  // `useLayoutEffect` para que todo se aplique ANTES de pintar (sin saltos).
  useLayoutEffect(() => {
    if (!menu) return;
    paintStrip(startRef.current.base);
    const strip = stripRef.current;
    const inner = innerRef.current;
    if (!strip || !inner) return;
    if (inner.offsetWidth) widthRef.current = inner.offsetWidth;
    // Alto: 56px si todas las etiquetas entran en una línea; si alguna se partió
    // en 2 (etiqueta más larga que `ITEM_MAX_W`), la franja crece para no
    // recortarla.
    const h = stripHeight(strip, menu.rowH);
    const extra = (h - menu.rowH) / 2;
    strip.style.top = `${menu.rowTop - extra}px`;
    strip.style.height = `${h}px`;
  }, [menu, paintStrip]);

  /** Empieza un gesto sobre `target` (touch o mouse). */
  const startDrag = useCallback(
    (target: HTMLElement, clientX: number, clientY: number) => {
    // ⚠️ Un gesto que arranca DENTRO de la franja no se resuelve acá: puede ser
    // el TOQUE de un botón (el `click` tiene que llegar al botón) o el ARRASTRE
    // que CIERRA el menú (decisión del usuario 2026-09-16: con el menú abierto
    // la franja ocupa la mitad derecha de la fila, así que el gesto de cerrar
    // arranca muy seguido sobre ella). `moveDrag` decide con el primer
    // movimiento.
    stripDragRef.current = false;
    fromStripRef.current = !!stripRef.current?.contains(target);
    if (fromStripRef.current) {
      stripStartRef.current = { x: clientX, y: clientY, t: Date.now() };
      return;
    }
    // Hasta que se confirme que la fila tiene acciones, el gesto no es de nadie
    // (así un toque en otra parte no dispara la navegación de la fila anterior).
    startRef.current.id = "";
    scrollerXRef.current = findScrollerX(target, wrapRef.current);
    const tr = target.closest<HTMLTableRowElement>("tr[data-row-id]");
    // Toque fuera de las filas (padding del card, franja abierta, etc.).
    if (!tr) {
      closeOpen();
      return;
    }
    const id = tr.getAttribute("data-row-id") ?? "";
    const actions = cbRef.current.actionsFor?.(id);
    const wrapRect = wrapRef.current?.getBoundingClientRect();
    if (!actions || actions.length === 0 || !wrapRect) {
      closeOpen();
      return;
    }
    // Otra fila abierta: se cierra AL INSTANTE (la nueva toma su lugar).
    if (openIdRef.current && openIdRef.current !== id) closeOpen(true);

    const rect = tr.getBoundingClientRect();
    tr.style.transition = "";
    if (stripRef.current) stripRef.current.style.transition = "";
    rowRef.current = tr;
    // Ancho TOTAL de la franja: si la fila YA tenía el menú abierto se usa el que
    // se MIDIÓ al montarlo; si no, una estimación que el `useLayoutEffect`
    // reemplaza enseguida por el ancho real de las etiquetas.
    const w =
      openIdRef.current === id && widthRef.current
        ? widthRef.current
        : actions.length * ITEM_EST_W;
    widthRef.current = w;
    const base = openIdRef.current === id ? w : 0;
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
    // Se guarda la geometría de la FILA (no la de la franja): el `top`/alto de la
    // franja se calculan en el render (estimación) y los corrige el
    // `useLayoutEffect` midiendo el contenido ya renderizado.
    setMenu({
      id,
      actions,
      rowTop: rect.top - wrapRect.top,
      rowH: rect.height,
      // Anclada al borde DERECHO de la fila; si la grilla desbordara la tarjeta,
      // se la clava al borde VISIBLE para que las acciones nunca queden fuera.
      right: Math.max(0, wrapRect.right - rect.right),
    });
    },
    [closeOpen]
  );

  /** Aplica el movimiento de un arrastre ya resuelto (horizontal = menú,
      vertical = scroll de la página). Devuelve true si el gesto es NUESTRO. */
  const applyDrag = useCallback(
    (clientX: number, clientY: number) => {
      const st = startRef.current;
      const row = rowRef.current;
      if (!row || !st.id) return false;
      const dx = clientX - st.x;
      const dy = clientY - st.y;

      if (!st.axis) {
        if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) return false;
        // Gesto VERTICAL = scroll de la PÁGINA: se suelta el menú (con
        // animación, mientras la página scrollea) y no frenamos el gesto.
        if (Math.abs(dy) > Math.abs(dx)) {
          st.axis = "y";
          rowRef.current = null;
          closeOpen();
          return false;
        }
        st.axis = "x";
      }

      // ¿La fila arrastrada es la que tiene el menú ABIERTO? Entonces el gesto
      // horizontal es SIEMPRE del MENÚ (cerrarlo), sin importar dónde empezó:
      // con la fila corrida hacia la izquierda, la zona de borde queda tapada
      // por la propia franja.
      const esFilaAbierta = !!st.id && openIdRef.current === st.id;

      // ¿La grilla todavía puede desplazarse en la dirección del swipe?
      const sc = scrollerXRef.current;
      const puedeScroll =
        !!sc &&
        (dx < 0
          ? sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 1
          : sc.scrollLeft > 0);

      // Gesto arrancado LEJOS del borde derecho: SIEMPRE scroll de la grilla
      // (el menú no reacciona desde el medio de la fila), salvo que la fila sea
      // la del menú ABIERTO (ver `esFilaAbierta`).
      if (!st.edge && !esFilaAbierta) {
        if (sc && puedeScroll) {
          sc.scrollLeft = st.scrollBase - dx;
          return true;
        }
        // Sin scroll horizontal disponible: el gesto no hace nada (si había un
        // menú abierto se cierra, con animación).
        st.axis = "y";
        rowRef.current = null;
        closeOpen();
        return false;
      }

      // Si venimos de estar scrolleando, la franja quedó anclada a la geometría
      // de ANTES del scroll: se re-ancla a la posición actual de la fila.
      // ⚠️ El `right` se mide sobre la fila SIN su desplazamiento (`translateX`):
      // si el menú ya estaba abierto la fila está corrida `base` px, así que hay
      // que devolverle ese desplazamiento (`rect.right + lastDRef`) o la franja
      // saltaría hacia la izquierda justo al empezar a cerrarla.
      if (!st.moved && stripRef.current) {
        const rect = row.getBoundingClientRect();
        const wrapRect = wrapRef.current?.getBoundingClientRect();
        if (wrapRect) {
          const derechaReal = rect.right + lastDRef.current;
          // Alto REAL del contenido (la etiqueta puede estar en 2 líneas).
          const h = stripHeight(stripRef.current, rect.height);
          const extra = (h - rect.height) / 2;
          stripRef.current.style.top = `${rect.top - wrapRect.top - extra}px`;
          stripRef.current.style.height = `${h}px`;
          stripRef.current.style.right = `${Math.max(
            0,
            wrapRect.right - derechaReal
          )}px`;
        }
      }

      // Zona de borde: MENÚ de la fila (reveal progresivo).
      st.moved = true;
      const w = widthRef.current;
      // dx < 0 al deslizar hacia la izquierda (el desplazamiento revelado crece).
      const d = Math.max(0, Math.min(st.base - dx, w + RUBBER));
      lastDRef.current = d;
      paintRow(d);
      paintStrip(Math.min(d, w));
      return true;
    },
    [closeOpen, paintRow, paintStrip]
  );

  /** Mueve el gesto en curso. Devuelve true si el gesto es NUESTRO (horizontal). */
  const moveDrag = useCallback(
    (clientX: number, clientY: number) => {
      // ── Gesto empezado DENTRO de la franja de acciones ──────────────────
      // En horizontal es el CIERRE del menú: se lo "promueve" a un arrastre de
      // la fila ABIERTA (mismo camino que arrastrarla, con `base` = ancho
      // revelado). En vertical se deja el gesto al navegador (scroll). Sin
      // movimiento no se toca nada: el `click` del botón sigue su curso.
      if (fromStripRef.current) {
        const sd = stripStartRef.current;
        const openRow = openRowRef.current;
        const openId = openIdRef.current;
        if (!sd || !openRow || !openId) return false;
        const dx = clientX - sd.x;
        const dy = clientY - sd.y;
        if (Math.abs(dx) < DECIDE_PX && Math.abs(dy) < DECIDE_PX) return false;
        fromStripRef.current = false;
        stripStartRef.current = null;
        if (Math.abs(dy) >= Math.abs(dx)) return false;
        stripDragRef.current = true;
        rowRef.current = openRow;
        openRow.style.transition = "";
        if (stripRef.current) stripRef.current.style.transition = "";
        lastDRef.current = widthRef.current;
        startRef.current = {
          x: sd.x,
          y: sd.y,
          t: sd.t,
          base: widthRef.current,
          scrollBase: 0,
          edge: true,
          axis: "x",
          moved: false,
          id: openId,
        };
      }
      return applyDrag(clientX, clientY);
    },
    [applyDrag]
  );

  /** Termina el gesto en curso (`isCancel` = el navegador lo canceló). */
  const endDrag = useCallback(
    (isCancel: boolean) => {
    if (fromStripRef.current) {
      fromStripRef.current = false;
      stripStartRef.current = null;
      return;
    }
    const st = startRef.current;
    const row = rowRef.current;
    rowRef.current = null;
    // El gesto no empezó en una fila con acciones.
    if (!st.id) return;
    const w = widthRef.current;
    // ¿La fila arrastrada era la del menú ABIERTO?
    const eraAbierta = openIdRef.current === st.id;

    // Arrastre horizontal terminado normalmente: abrir o volver (las dos con
    // animación: fila y franja se mueven juntas, ver `animateClose`).
    if (row && st.axis === "x" && st.moved && !isCancel) {
      const abrir = lastDRef.current > w * OPEN_RATIO;
      if (abrir) {
        if (stripRef.current) {
          stripRef.current.style.transition = `width ${ANIM_MS}ms ${ANIM_EASE}`;
        }
        row.style.transition = `transform ${ANIM_MS}ms ${ANIM_EASE}`;
        row.style.transform = `translateX(${-w}px)`;
        openRowRef.current = row;
        openIdRef.current = st.id;
        lastDRef.current = w;
        paintStrip(w);
      } else {
        openRowRef.current = null;
        openIdRef.current = null;
        lastDRef.current = 0;
        animateClose(row, st.id);
      }
      return;
    }

    // El navegador CANCELÓ el gesto a mitad de camino (p. ej. tomó el scroll):
    // la fila vuelve a donde estaba —abierta, si ya lo estaba— con animación.
    if (row && isCancel) {
      if (eraAbierta) {
        if (stripRef.current) {
          stripRef.current.style.transition = `width ${ANIM_MS}ms ${ANIM_EASE}`;
        }
        row.style.transition = `transform ${ANIM_MS}ms ${ANIM_EASE}`;
        row.style.transform = `translateX(${-w}px)`;
        lastDRef.current = w;
        paintStrip(w);
      } else {
        lastDRef.current = 0;
        animateClose(row, st.id);
      }
      return;
    }

    // TOQUE (sin desplazamiento decidido): si había un menú abierto se cierra
    // (con animación); si no, se navega. Del desmontaje de la franja se ocupa
    // `animateClose` al terminar el cierre: hacerlo acá cortaría la animación.
    const esToque = !isCancel && st.axis === null && Date.now() - st.t < TAP_MS;
    const habiaAbierto = openIdRef.current !== null;
    if (habiaAbierto) closeOpen();
    if (esToque && !habiaAbierto) cbRef.current.onRowTap?.(st.id);
    },
    [animateClose, closeOpen, paintStrip]
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
          style={{
            // Estimación: el alto definitivo lo fija el `useLayoutEffect`
            // midiendo el contenido (etiquetas de 2 líneas).
            top: menu.rowTop - stripExtra(menu.rowH),
            height: menu.rowH + stripExtra(menu.rowH) * 2,
            right: menu.right,
          }}
          // `bg-card`: la franja se pinta con el mismo fondo que la tarjeta (las
          // filas son transparentes), así las acciones parecen estar "detrás" de
          // la fila que se corre —igual que el swipe del Mail de iOS— y, cuando
          // la franja se estira por encima del alto de la fila, tapa lo que
          // quedaría a la vista de las filas vecinas.
          className="absolute z-10 w-0 overflow-hidden bg-card"
        >
          <div
            ref={innerRef}
            // `w-max`: el contenedor mide lo que miden sus acciones, y cada
            // acción lo que mide su etiqueta (`min-w-16 max-w-28`).
            className="ml-auto flex h-full w-max items-center"
          >
            {menu.actions.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={(e) => {
                    // Un gesto que se movió sobre la franja fue el CIERRE del
                    // menú, no un toque: no se ejecuta la acción.
                    if (stripDragRef.current) {
                      e.preventDefault();
                      return;
                    }
                    // Cierre animado (la franja se angosta mientras la fila
                    // vuelve) y la acción corre enseguida.
                    closeOpen();
                    a.onClick();
                  }}
                  // Ancho = el de la etiqueta (`ITEM_MIN_W` para las cortas,
                  // `ITEM_MAX_W` para que no crezca sin límite). El padding es
                  // chico (4px por lado) para que la PÍLDORA aproveche el ancho.
                  style={{ minWidth: ITEM_MIN_W, maxWidth: ITEM_MAX_W }}
                  className="flex h-full flex-none flex-col items-center justify-center gap-0.5 px-1 text-center"
                >
                  {/* Círculo de color (o PÍLDORA ancha si `wide`) + ícono
                      blanco, con la etiqueta debajo (estética del swipe del Mail
                      de iOS, 2026-09-17). */}
                  <span
                    className={cn(
                      "flex h-10 shrink-0 items-center justify-center rounded-full text-white transition-opacity active:opacity-80",
                      a.wide ? "w-full" : "w-10",
                      TONE_BG[a.tone ?? toneDe(a.key)]
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span
                    data-swipe-label
                    className="max-w-full text-[10px] leading-3 font-medium wrap-break-word text-card-foreground"
                  >
                    {a.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
