"use client";

import { useCallback, useRef } from "react";
import type { TouchEvent } from "react";

/** Movimiento (px) por debajo del cual el gesto se considera un **tap**. */
const UMBRAL_TAP_PX = 10;
/** Cuánto se espera antes del 2º ocultado (ver la nota de la red de seguridad). */
const MS_RED_SEGURIDAD = 350;
/**
 * Selector de **controles**: si el toque arranca acá NO se cancela el `touchend`.
 *
 * ⚠️ **Bug reportado en prod (2026-10-03)**: el encabezado de los paneles de
 * gráficos viaja como `encabezado` **dentro** del contenedor que maneja los toques
 * (por eso el hook envuelve al panel) y ahí adentro viven las **pestañas
 * Resumen/Histórico** y el **⋯**. Como `preventDefault()` en el `touchend` de un
 * tap suprime el `click` en iOS, esos controles **dejaron de responder**. Ahora,
 * si el gesto empieza sobre un control, se saltea el `preventDefault` (el tooltip
 * se sigue apagando igual).
 */
const SELECTOR_CONTROL =
  "a, button, [role='button'], input, select, textarea, label, summary";

/**
 * Oculta el tooltip de un gráfico Recharts al levantar el dedo en mobile.
 *
 * Por qué: Recharts 3 actualiza el índice activo del tooltip en `onTouchMove`,
 * pero su `onTouchEnd` solo reenvía el handler del usuario y NO limpia el
 * estado de interacción (ver `recharts/es6/chart/RechartsWrapper.js`). La única
 * acción que lo limpia es `mouseLeaveChart()`, que Recharts despacha desde el
 * `onMouseLeave` del div `.recharts-wrapper`. Resultado sin este hook: el
 * tooltip (y el punto activo del `activeDot`) quedan pegados después de soltar.
 *
 * Cómo: se enganchan los handlers de touch al contenedor del gráfico y, al
 * terminar/cancelar el gesto, se dispara un `mouseout` sintético sobre el
 * `.recharts-wrapper`. React deriva su `onMouseLeave` de `mouseout`, así que
 * Recharts limpia el estado y tooltip + punto activo desaparecen, igual que al
 * sacar el mouse en desktop.
 *
 * ⚠️ **2026-10-03 (bug reportado en prod mobile)**: ocultarlo en el `touchend`
 * **no alcanzaba**. iOS emite los eventos de mouse **emulados** (mouseover /
 * mousemove) **después** del `touchend` ⇒ el tooltip se apagaba y volvía a
 * encenderse en el mismo gesto, y como ningún `mouseout` posterior lo apagaba
 * quedaba pegado **hasta el toque siguiente**. Ahora, además del `mouseout`, en
 * un **tap** se cancela el `touchend` (`preventDefault`) para que el navegador no
 * emita los eventos emulados, y siempre queda una **red de seguridad** que
 * vuelve a apagar el tooltip ~350 ms después de soltar el dedo.
 *
 * Uso: los handlers van en el contenedor del gráfico (cualquier ancestro del
 * `.recharts-wrapper` sirve, p. ej. la tarjeta del panel).
 *
 *   const tooltipTouch = useHideTooltipOnTouch();
 *   <div onTouchStart={tooltipTouch.onTouchStart}
 *        onTouchEnd={tooltipTouch.onTouchEnd}
 *        onTouchCancel={tooltipTouch.onTouchCancel}>
 *     <ResponsiveContainer>...</ResponsiveContainer>
 *   </div>
 */
export function useHideTooltipOnTouch<T extends HTMLElement = HTMLDivElement>() {
  /** Punto donde arrancó el toque: distingue un **tap** de un **arrastre**. */
  const desdeRef = useRef<{ x: number; y: number } | null>(null);
  /** ¿El toque arrancó sobre un control interactivo? (entonces no se cancela). */
  const controlRef = useRef(false);
  /** Ocultados diferidos pendientes (se cancelan al volver a tocar). */
  const timersRef = useRef<number[]>([]);

  const limpiarTimers = useCallback(() => {
    for (const t of timersRef.current) window.clearTimeout(t);
    timersRef.current = [];
  }, []);

  /**
   * Apaga el tooltip: `mouseLeaveChart()` —el único que limpia `hover.active`—
   * lo despacha Recharts desde el `onMouseLeave` del `.recharts-wrapper`, y React
   * deriva ese evento de un `mouseout` nativo ⇒ se le dispara uno sintético.
   */
  const apagar = useCallback((raiz: HTMLElement) => {
    const wrapper =
      raiz.querySelector<HTMLElement>(".recharts-wrapper") ??
      (raiz.classList.contains("recharts-wrapper") ? raiz : null);
    wrapper?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
  }, []);

  const onTouchStart = useCallback(
    (e: TouchEvent<T>) => {
      limpiarTimers();
      const t = e.touches[0];
      desdeRef.current = t ? { x: t.clientX, y: t.clientY } : null;
      // ¿El dedo cayó sobre las pestañas / el ⋯ del encabezado? (ver arriba)
      const destino = e.target;
      controlRef.current =
        destino instanceof Element && destino.closest(SELECTOR_CONTROL) !== null;
    },
    [limpiarTimers]
  );

  const onTouchEnd = useCallback(
    (e: TouchEvent<T>) => {
      const raiz = e.currentTarget;
      const desde = desdeRef.current;
      desdeRef.current = null;
      const t = e.changedTouches[0];
      const movido =
        desde && t ? Math.hypot(t.clientX - desde.x, t.clientY - desde.y) : 0;

      // 🔑 **Tap**: se cancela el `touchend` para que el navegador NO emita los
      // eventos de mouse **emulados** (iOS los dispara DESPUÉS del touchend y son
      // los que volvían a encender el tooltip ⇒ quedaba pegado hasta el toque
      // siguiente). En un **arrastre** no se cancela (el navegador está cerrando
      // el scroll/snap) y ese caso lo cubre la red de seguridad de abajo.
      if (movido <= UMBRAL_TAP_PX && !controlRef.current) {
        try {
          e.preventDefault();
        } catch {
          /* listener pasivo ⇒ cae a la red de seguridad */
        }
      }
      controlRef.current = false;

      limpiarTimers();
      apagar(raiz);
      // Red de seguridad: si el navegador igual emite un `mousemove` al soltar,
      // se vuelve a apagar unos ms después (imperceptible) ⇒ el tooltip nunca
      // queda pegado, que era el bug reportado en prod el 2026-10-03.
      timersRef.current.push(
        window.setTimeout(() => apagar(raiz), MS_RED_SEGURIDAD)
      );
    },
    [apagar, limpiarTimers]
  );

  return { onTouchStart, onTouchEnd, onTouchCancel: onTouchEnd };
}
