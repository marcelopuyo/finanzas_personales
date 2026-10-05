"use client";

import { useCallback, useRef } from "react";
import type { TouchEvent } from "react";

/** Ventana (ms) sobre la que se mide la velocidad **final** del gesto. */
const VENTANA_MS = 110;
/**
 * Velocidad mínima (px/ms) para considerarlo un *flick*. Un scrub cómodo ronda
 * 0,2-0,35; un latigazo pasa de 1. Si queda sensible o duro, **este es el número
 * que hay que mover**.
 */
const VELOCIDAD_MINIMA = 0.5;
/** Recorrido mínimo (px): por debajo de esto el gesto es un toque, no un desliz. */
const RECORRIDO_MINIMO = 24;

/** Una posición del dedo con su momento. */
interface Muestra {
  x: number;
  y: number;
  t: number;
}

/**
 * Detecta un **flick lateral** (deslizamiento rápido) y avisa hacia dónde.
 *
 * Por qué existe: en la **franja del gráfico** del carrusel de Inicio el dedo lo
 * toma el gráfico (`touch-action: pan-y`, ver `line-chart.tsx`), así que el gesto
 * lateral **no** mueve el carrusel: scrubbea el tooltip. El pedido del usuario
 * (2026-10-05) es que un deslizamiento **lento** siga mostrando el tooltip y uno
 * **rápido** pase de tarjeta, como al deslizar en el resto del encabezado.
 *
 * 🔑 **La decisión se toma al soltar**, no al cruzar un umbral en movimiento:
 * mientras el dedo está apoyado el gesto es del gráfico, y recién al soltar se
 * sabe si fue un *scrub* (queda el tooltip) o un *flick* (cambia de tarjeta). La
 * velocidad se mide sobre los **últimos** `VENTANA_MS`, igual que la inercia
 * nativa: un arrastre lento que termina en un latigazo cuenta como flick, y uno
 * rápido que se frena antes de soltar no.
 */
export function useFlickLateral(alFlick?: (dir: 1 | -1) => void) {
  const muestrasRef = useRef<Muestra[]>([]);

  const onTouchStart = useCallback((e: TouchEvent<HTMLElement>) => {
    const t = e.touches[0];
    muestrasRef.current = t
      ? [{ x: t.clientX, y: t.clientY, t: performance.now() }]
      : [];
  }, []);

  const onTouchMove = useCallback((e: TouchEvent<HTMLElement>) => {
    const t = e.touches[0];
    if (!t) return;
    const ahora = performance.now();
    const muestras = muestrasRef.current;
    muestras.push({ x: t.clientX, y: t.clientY, t: ahora });
    // Sólo interesa la ventana reciente (más una muestra de borde).
    while (muestras.length > 2 && ahora - muestras[0].t > VENTANA_MS) {
      muestras.shift();
    }
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent<HTMLElement>) => {
      const muestras = muestrasRef.current;
      muestrasRef.current = [];
      if (!alFlick) return;
      const t = e.changedTouches[0];
      if (!t || muestras.length < 2) return;
      const desde = muestras[0];
      const dx = t.clientX - desde.x;
      const dy = t.clientY - desde.y;
      // Gestos verticales (el gráfico deja scrollear la página) no cambian tarjeta.
      if (Math.abs(dx) < RECORRIDO_MINIMO) return;
      if (Math.abs(dx) < Math.abs(dy)) return;
      const ms = Math.max(performance.now() - desde.t, 1);
      if (Math.abs(dx) / ms < VELOCIDAD_MINIMA) return;
      alFlick(dx < 0 ? 1 : -1);
    },
    [alFlick]
  );

  /** Cancelado (el navegador se quedó con el gesto): no cuenta como flick. */
  const onTouchCancel = useCallback(() => {
    muestrasRef.current = [];
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}
