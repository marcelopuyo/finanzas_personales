"use client";

import { useCallback, useEffect, useRef } from "react";
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
/**
 * Ventana (ms) para **decidir** qué es el gesto, medida desde el `touchstart`. Si al
 * cumplirse todavía no se reconoció un flick, el gesto es un *scrub* lento ⇒ el tooltip
 * **vuelve a mostrarse** con el dedo apoyado (fix del pendiente de §237).
 */
const DECISION_MS = 250;

/** Una posición del dedo con su momento. */
interface Muestra {
  x: number;
  y: number;
  t: number;
}

interface OpcionesFlick {
  /** Se llama cuando el gesto **resulta** un flick (al soltar). */
  alFlick?: (dir: 1 | -1) => void;
  /**
   * Se llama **al apoyar el dedo** en la franja, antes de cualquier `touchmove`.
   *
   * 🔑 Es el fix del pendiente de §237: antes el tapado recién empezaba cuando la
   * velocidad **ya había cruzado** el umbral, así que en iOS los primeros cuadros del
   * arrastre se veían con el tooltip a la vista. Tapa de entrada y lo destapa
   * `alLento` si el gesto resulta un *scrub*.
   *
   * ⚠️ Barato y **sin estado de React** (un atributo de DOM alcanza): ver la nota de
   * abajo.
   */
  alEmpezar?: () => void;
  /**
   * Se llama **una vez por gesto**, `DECISION_MS` después del `touchstart`, **sólo si
   * todavía no se reconoció un flick** ⇒ el gesto es un *scrub* lento y el tooltip
   * debe volver a mostrarse con el dedo apoyado (es el comportamiento que el usuario
   * pidió conservar).
   */
  alLento?: () => void;
  /**
   * Se llama **una vez por gesto**, en cuanto el movimiento ya viene rápido y
   * horizontal (todavía con el dedo apoyado). Sirve para **volver a tapar** el tooltip
   * del gráfico si el gesto empezó lento y terminó en latigazo.
   *
   * ⚠️ Lo que se llame acá tiene que ser **barato y sin estado de React** (ver
   * `CuentaSlide` y la nota de arriba): un atributo de DOM alcanza.
   */
  alRapido?: () => void;
  /**
   * Se llama en **cada `touchmove`** posterior al reconocimiento del flick, con el
   * desplazamiento horizontal en px **desde el punto donde se reconoció** (negativo =
   * hacia la izquierda). Es para que el carrusel **siga el dedo** en vez de esperar al
   * `touchend` (§255).
   *
   * ⚠️ Misma regla que el resto: acá adentro **nada de React** — el carrusel mueve su
   * `scrollLeft` a mano (una escritura de DOM).
   */
  alArrastrar?: (dx: number) => void;
  /**
   * Se llama **al final** del gesto (`touchend` o `touchcancel`), **después** de
   * `alFlick`: es el momento de **resolver** el arrastre (aterrizar en una tarjeta).
   */
  alTerminar?: () => void;
  /**
   * Se llama **siempre** al soltar (o cancelar) un gesto que empezó en la franja,
   * sea flick o no.
   *
   * 🔑 Es lo que deja la franja **tapada hasta el toque siguiente** (no por un timer
   * corto): en iOS los `mouse*` **emulados** que llegan después del `touchend` volvían
   * a encender el tooltip justo mientras la tarjeta se deslizaba, y podían llegar más
   * tarde que la ventana de 900 ms que se usaba antes (§237). La banda queda sin
   * tooltips apenas se levanta el dedo y el toque siguiente la despierta (ver
   * `inicio-panel.tsx`), así que tampoco queda pegado un **arrastre lento**.
   */
  alSoltar?: () => void;
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
 * 🔑 **La decisión del flick se toma al soltar**, no al cruzar un umbral en movimiento:
 * mientras el dedo está apoyado el gesto es del gráfico, y recién al soltar se
 * sabe si fue un *scrub* (queda el tooltip) o un *flick* (cambia de tarjeta). La
 * velocidad se mide sobre los **últimos** `VENTANA_MS`, igual que la inercia
 * nativa: un arrastre lento que termina en un latigazo cuenta como flick, y uno
 * rápido que se frena antes de soltar no.
 *
 * ⚠️ **Al soltar se avisa siempre** (`alSoltar`), sea flick o no: en iOS, si no, los
 * eventos de mouse **emulados** que llegan después del `touchend` vuelven a encender
 * el tooltip y queda **pegado hasta el toque siguiente**. Ver `alSoltar`.
 *
 * ⚠️🔑 **Nada de lo que se llame desde acá puede hacer trabajo de React** (estado,
 * re-render, montar/desmontar el `<Tooltip>`): eso atrasa los `touchmove`, la
 * velocidad medida cae por debajo del umbral y **el flick deja de detectarse**. Pasó
 * el 2026-10-05 y se revirtió en §234: ahora todo se resuelve con **DOM** (atributo
 * + `mouseout`) y el silencio de la banda es un `ref`.
 */
export function useFlickLateral({
  alFlick,
  alEmpezar,
  alLento,
  alRapido,
  alArrastrar,
  alSoltar,
  alTerminar,
}: OpcionesFlick = {}) {
  const muestrasRef = useRef<Muestra[]>([]);
  /** ¿Ya se avisó `alRapido` en este gesto? (se llama una sola vez) */
  const avisadoRef = useRef(false);
  /** `clientX` del punto donde se reconoció el flick (referencia de `alArrastrar`). */
  const xReconocidoRef = useRef<number | undefined>(undefined);
  /** Timer de la decisión lento/flick (`DECISION_MS`). */
  const decisionRef = useRef<number | undefined>(undefined);

  const limpiarDecision = () => {
    if (decisionRef.current !== undefined) {
      window.clearTimeout(decisionRef.current);
      decisionRef.current = undefined;
    }
  };

  useEffect(
    () => () => {
      if (decisionRef.current !== undefined) {
        window.clearTimeout(decisionRef.current);
      }
    },
    []
  );

  const onTouchStart = useCallback(
    (e: TouchEvent<HTMLElement>) => {
      const t = e.touches[0];
      muestrasRef.current = t
        ? [{ x: t.clientX, y: t.clientY, t: performance.now() }]
        : [];
      avisadoRef.current = false;
      xReconocidoRef.current = undefined;
      limpiarDecision();
      // Tapa **de entrada**: así no se ve ni el primer cuadro del arrastre, que era
      // justo lo que se filtraba en iOS.
      alEmpezar?.();
      decisionRef.current = window.setTimeout(() => {
        decisionRef.current = undefined;
        // Si en `DECISION_MS` no hubo flick, el gesto es un scrub lento.
        if (!avisadoRef.current) alLento?.();
      }, DECISION_MS);
    },
    [alEmpezar, alLento]
  );

  const onTouchMove = useCallback(
    (e: TouchEvent<HTMLElement>) => {
      const t = e.touches[0];
      if (!t) return;
      const ahora = performance.now();
      const muestras = muestrasRef.current;
      muestras.push({ x: t.clientX, y: t.clientY, t: ahora });
      // Sólo interesa la ventana reciente (más una muestra de borde).
      while (muestras.length > 2 && ahora - muestras[0].t > VENTANA_MS) {
        muestras.shift();
      }
      if (!avisadoRef.current && (alRapido || alArrastrar) && esFlick(muestras)) {
        // Se reconoció el flick: se avisa **una sola vez** y desde acá se mide el
        // arrastre, así el carrusel sigue el dedo desde este punto (sin "salto").
        avisadoRef.current = true;
        xReconocidoRef.current = t.clientX;
        alRapido?.();
      } else if (avisadoRef.current) {
        alArrastrar?.(t.clientX - (xReconocidoRef.current ?? t.clientX));
      }
    },
    [alRapido, alArrastrar]
  );

  const onTouchEnd = useCallback(
    (e: TouchEvent<HTMLElement>) => {
      limpiarDecision();
      const muestras = muestrasRef.current;
      muestrasRef.current = [];
      // Se soltó el dedo: la banda queda sin tooltips (ver `alSoltar`), incluso si el
      // gesto **no** llega a ser un flick.
      alSoltar?.();
      if (alFlick && esFlick(muestras, e.changedTouches[0])) {
        const t = e.changedTouches[0];
        const desde = muestras[0];
        alFlick(t.clientX - desde.x < 0 ? 1 : -1);
        /**
         * Se cancela el `touchend` para que iOS **no emita sus eventos de mouse
         * emulados**: llegan después de soltar y vuelven a encender el tooltip
         * justo cuando la tarjeta está deslizándose. Es seguro acá porque sólo se
         * llega a este punto con un gesto **horizontal** (no hay inercia de scroll
         * vertical que perder).
         */
        try {
          e.preventDefault();
        } catch {
          /* listener pasivo */
        }
      }
      // Último aviso del gesto: lo que haya quedado abierto (un arrastre del carrusel,
      // p. ej.) se resuelve acá, **después** de `alFlick`.
      alTerminar?.();
    },
    [alFlick, alSoltar, alTerminar]
  );

  /** Cancelado (el navegador se quedó con el gesto): no cuenta como flick. */
  const onTouchCancel = useCallback(() => {
    limpiarDecision();
    muestrasRef.current = [];
    avisadoRef.current = false;
    // También acá: el gesto terminó ⇒ la banda queda sin tooltips.
    alSoltar?.();
    alTerminar?.();
  }, [alSoltar, alTerminar]);

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}

/**
 * ¿Las muestras describen un flick? Sin posición final (durante el arrastre) se
 * usa la última muestra como referencia.
 */
function esFlick(muestras: Muestra[], fin?: { clientX: number; clientY: number }) {
  if (muestras.length < 2) return false;
  const desde = muestras[0];
  const hasta = fin
    ? { x: fin.clientX, y: fin.clientY, t: performance.now() }
    : muestras[muestras.length - 1];
  const dx = hasta.x - desde.x;
  const dy = hasta.y - desde.y;
  // Gestos verticales (el gráfico deja scrollear la página) no cuentan.
  if (Math.abs(dx) < RECORRIDO_MINIMO) return false;
  if (Math.abs(dx) < Math.abs(dy)) return false;
  const ms = Math.max(hasta.t - desde.t, 1);
  return Math.abs(dx) / ms >= VELOCIDAD_MINIMA;
}
