"use client";

import { useCallback } from "react";
import type { TouchEvent } from "react";

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
 * Uso: los handlers van en el contenedor del gráfico (cualquier ancestro del
 * `.recharts-wrapper` sirve, p. ej. la tarjeta del panel).
 *
 *   const tooltipTouch = useHideTooltipOnTouch();
 *   <div onTouchEnd={tooltipTouch.onTouchEnd}
 *        onTouchCancel={tooltipTouch.onTouchCancel}>
 *     <ResponsiveContainer>...</ResponsiveContainer>
 *   </div>
 */
export function useHideTooltipOnTouch<T extends HTMLElement = HTMLDivElement>() {
  const hideTooltip = useCallback((e: TouchEvent<T>) => {
    const wrapper = e.currentTarget.querySelector<HTMLElement>(
      ".recharts-wrapper"
    );
    wrapper?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
  }, []);

  return { onTouchEnd: hideTooltip, onTouchCancel: hideTooltip };
}
