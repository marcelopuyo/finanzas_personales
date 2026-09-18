"use client";

import { useEffect, useRef } from "react";

/** Máximo movimiento del dedo (px) para que un gesto cuente como TAP. */
export const TAP_MOVE_PX = 10;
/** Duración máxima (ms) de un TAP. */
export const TAP_MS = 500;

interface OpcionesTap {
  /** Duración máxima del toque, en ms (default `TAP_MS`). */
  ms?: number;
  /** Movimiento máximo del dedo, en px (default `TAP_MOVE_PX`). */
  move?: number;
}

/**
 * TAP confiable en mobile: dispara `onTap` en **`touchend`** (solo si el gesto fue
 * un toque corto y sin movimiento: un scroll o un long press quedan descartados)
 * **y** en `click` (mouse/trackpad), con un guard por tiempo para no dispararlo
 * dos veces cuando el navegador emite el `click` después del `touchend`.
 *
 * ⚠️ **Por qué NO alcanza con `onClick`** (2026-09-18): en iOS un toque puede NO
 * generar `click` — el navegador lo clasifica como scroll y lo descarta — así que
 * la acción se pierde y el usuario tiene que tocar 2-3 veces. Pasó con el panel
 * "Trabajo" del dashboard (zona grande) y con su botón ⋯. Los touch events sí
 * llegan siempre: es el mismo hallazgo que obligó a rehacer el swipe del CRUD de
 * períodos con touch events (§109 de la bitácora).
 *
 * Uso: **spread** de los handlers en el elemento, **sin** `onClick` propio (el
 * hook ya lo aporta):
 *
 * ```tsx
 * const tap = useTap(() => setOpen((o) => !o));
 * <button type="button" {...tap}>⋯</button>
 * ```
 *
 * Los handlers son estables (el callback va en un ref), así que se pueden pasar a
 * componentes memorizados sin re-renderizar.
 */
export function useTap(onTap: () => void, opciones: OpcionesTap = {}) {
  const ms = opciones.ms ?? TAP_MS;
  const move = opciones.move ?? TAP_MOVE_PX;

  const cbRef = useRef(onTap);
  useEffect(() => {
    cbRef.current = onTap;
  });

  /** Punto/instante donde empezó el toque en curso. */
  const origen = useRef<{ x: number; y: number; t: number } | null>(null);
  /** Instante del último tap disparado por TOUCH (para descartar su `click`). */
  const ultimoTap = useRef(0);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      origen.current = t
        ? { x: t.clientX, y: t.clientY, t: Date.now() }
        : null;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const o = origen.current;
      origen.current = null;
      const t = e.changedTouches[0];
      if (!o || !t) return;
      if (Date.now() - o.t > ms) return; // long press / selección de texto
      if (Math.hypot(t.clientX - o.x, t.clientY - o.y) > move) return; // scroll
      ultimoTap.current = Date.now();
      cbRef.current();
    },
    onClick: () => {
      // Es el `click` que el navegador emite DESPUÉS del `touchend`.
      if (Date.now() - ultimoTap.current < ms) return;
      cbRef.current();
    },
  };
}
