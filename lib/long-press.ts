"use client";

import { useCallback, useEffect, useRef, type MouseEvent, type TouchEvent } from "react";

/**
 * LONG PRESS en mobile (2026-09-17).
 *
 * El navegador NO tiene un evento `longpress`: hay que detectarlo a mano con un
 * temporizador sobre los touch events (500 ms es el estándar de Android/iOS).
 *
 * Por qué no usar `contextmenu`: en Chrome/Android sí se dispara con el dedo
 * apoyado, pero en iOS el long press sobre texto abre el **magnificador** y
 * sobre enlaces/imágenes el **callout nativo**, así que no sirve como trigger
 * único. Además, sin esto el navegador podría abrir su menú nativo al mismo
 * tiempo que nuestro gesto (por eso `onContextMenu` hace `preventDefault()`
 * mientras el gesto está en curso o recién se disparó).
 *
 * Reglas del gesto:
 * - Se **cancela** si el dedo se mueve más de `MOVER_MAX_PX` (es scroll/swipe),
 *   si se levanta antes de tiempo (`touchend`) o si el sistema cancela
 *   (`touchcancel`).
 * - Dispara **una sola vez** por gesto y avisa con una vibración corta (solo
 *   Android: iOS no implementa `navigator.vibrate`).
 * - ⚠️ El navegador igual emite un `click` al soltar: el consumidor tiene que
 *   descartarlo con `consumirClick()`, que devuelve `true` **una única vez**
 *   (el flag lo limpia el `touchstart` del gesto siguiente, así que un toque
 *   posterior nunca queda "comido").
 *
 * ⚠️ Convivencia: conviene NO usarlo sobre elementos que ya manejen gestos
 * horizontales (p. ej. el swipe de `SwipeRowActions`): ahí el `touchmove`
 * cancela el gesto igual, pero el orden de las reglas se vuelve difícil de
 * razonar. En iOS, además, el elemento debería llevar `select-none` y
 * `[-webkit-touch-callout:none]` para que el gesto no dispare la selección de
 * texto ni el callout.
 */
export const LONG_PRESS_MS = 500;

/** Movimiento máximo tolerado (px) antes de cancelarlo: es un scroll. */
const MOVER_MAX_PX = 10;

interface OpcionesLongPress {
  /** Duración del gesto (default `LONG_PRESS_MS`). */
  ms?: number;
  /** `false` desactiva el gesto (p. ej. una tarjeta sin acciones). */
  habilitado?: boolean;
  /** Vibración corta al disparar (default `true`; solo funciona en Android). */
  vibrar?: boolean;
}

export interface LongPressHandlers {
  onTouchStart: (e: TouchEvent<HTMLElement>) => void;
  onTouchMove: (e: TouchEvent<HTMLElement>) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  onContextMenu: (e: MouseEvent<HTMLElement>) => void;
}

export function useLongPress(
  onLongPress: () => void,
  { ms = LONG_PRESS_MS, habilitado = true, vibrar = true }: OpcionesLongPress = {}
) {
  const timer = useRef<number | null>(null);
  /** Dónde empezó el gesto (para medir si el dedo se movió). */
  const origen = useRef<{ x: number; y: number } | null>(null);
  /** Momento del disparo: `0` = no hubo long press en este gesto. */
  const disparadoEn = useRef(0);
  /** Callback en ref: el gesto se arma una vez y no depende del re-render. */
  const alDisparar = useRef(onLongPress);
  useEffect(() => {
    alDisparar.current = onLongPress;
  });

  const cancelar = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    origen.current = null;
  }, []);

  // Al desmontar (o al deshabilitar el gesto) no puede quedar un timer vivo.
  useEffect(() => {
    if (!habilitado) cancelar();
    return cancelar;
  }, [cancelar, habilitado]);

  const handlers: LongPressHandlers = {
    onTouchStart: (e) => {
      if (!habilitado || e.touches.length !== 1) return;
      const t = e.touches[0];
      origen.current = { x: t.clientX, y: t.clientY };
      // Gesto nuevo: el flag del long press anterior ya no cuenta.
      disparadoEn.current = 0;
      timer.current = window.setTimeout(() => {
        timer.current = null;
        disparadoEn.current = Date.now();
        if (vibrar && typeof navigator.vibrate === "function") {
          navigator.vibrate(10);
        }
        alDisparar.current();
      }, ms);
    },
    onTouchMove: (e) => {
      if (timer.current === null || !origen.current) return;
      const t = e.touches[0];
      if (
        Math.abs(t.clientX - origen.current.x) > MOVER_MAX_PX ||
        Math.abs(t.clientY - origen.current.y) > MOVER_MAX_PX
      ) {
        cancelar();
      }
    },
    onTouchEnd: cancelar,
    onTouchCancel: cancelar,
    onContextMenu: (e) => {
      // Mientras el gesto está en curso (o acaba de disparar) se bloquea el menú
      // nativo del navegador, que saldría encima del nuestro.
      if (habilitado && (timer.current !== null || disparadoEn.current > 0)) {
        e.preventDefault();
      }
    },
  };

  /**
   * ¿El `click` que está llegando es el eco del long press? Devuelve `true` una
   * vez para que el consumidor lo descarte.
   */
  const consumirClick = useCallback(() => {
    if (disparadoEn.current === 0) return false;
    disparadoEn.current = 0;
    return true;
  }, []);

  return { props: handlers, consumirClick };
}
