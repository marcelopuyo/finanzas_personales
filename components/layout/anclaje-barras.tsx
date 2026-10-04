"use client";

import { useEffect } from "react";

/**
 * **Anclaje de las barras a los bordes VISIBLES** (2026-10-04).
 *
 * 🐞 El problema: un elemento `position: fixed` se ancla al **layout viewport**,
 * pero lo que ve el usuario es el **visual viewport**, y los dos no siempre
 * coinciden:
 *
 * - **Pinch-zoom** (`visualViewport.scale ≠ 1`): al alejar la página, el layout
 *   queda **más chico que la pantalla** ⇒ las barras se “despegan” del borde y
 *   flotan más arriba. Al acercar y desplazar, quedan fuera de la parte visible.
 * - **Teclado en pantalla**: en Android el layout no se encoge, así que la barra
 *   queda **tapada** por el teclado; en iOS el browser la sube por su cuenta.
 * - **Viewport trabado**: bug conocido de iOS/Safari al cerrar el teclado o al
 *   scrollear el documento — las barras quedan corridas hasta **reiniciar la app**
 *   (era el síntoma reportado: era la única forma de restablecerlas).
 *
 * ✅ La corrección es **medida, no asumida**: se compara el borde visible
 * (`visualViewport.offsetTop` / `height`, la única fuente que refleja el estado
 * real) contra la posición real del anclaje (`getBoundingClientRect()`) y se
 * publica la diferencia en dos variables CSS que consumen las barras
 * (`--fp-desfase-superior` / `--fp-desfase-inferior`). Así el mecanismo se
 * autocorrige sin conocer la causa ni las unidades del zoom.
 *
 * ⚠️ En el caso normal las dos variables valen `0px` ⇒ **cero cambios** respecto
 * del comportamiento actual. Sólo se escribe cuando la medición da distinto de
 * cero, y se ignoran los valores absurdos (una medición a medio camino entre
 * eventos no debe mandar la barra a la loma del molino).
 *
 * ⚠️ Si el browser YA movió el elemento (caso iOS con teclado) la medición da 0 y
 * el mecanismo no interfiere: no hay doble desplazamiento.
 */
export function AnclajeBarras() {
  useEffect(() => {
    const raiz = document.documentElement;
    /** Desfases aplicados hoy en las variables (para poder medir la base real). */
    let aplicadoSup = 0;
    let aplicadoInf = 0;
    /** Timers del “asentamiento” (los estados de estos bugs tardan en estabilizar). */
    const timers: number[] = [];

    /** ¿El valor es plausible? (evita saltos por mediciones a mitad de animación). */
    const plausible = (v: number) =>
      Number.isFinite(v) && Math.abs(v) <= window.innerHeight;

    /**
     * **Re-enganche** de un `fixed` que el motor dejó “colgado” (bug conocido de
     * iOS después de un pinch o del teclado): cambiar el `transform` y **forzar un
     * reflow** hace que el compositor lo vuelva a posicionar. Va rate-limited porque
     * es un parche de último recurso, no parte del cálculo normal.
     */
    let ultimoReenganche = 0;
    const reenganchar = (el: HTMLElement) => {
      const ahora = Date.now();
      if (ahora - ultimoReenganche < 1500) return;
      ultimoReenganche = ahora;
      const previo = el.style.transform;
      el.style.transform = "translateZ(0)";
      void el.offsetHeight;
      el.style.transform = previo;
    };

    const escribir = (variable: string, valor: number) => {
      raiz.style.setProperty(variable, `${valor}px`);
    };

    /**
     * El documento **no** debe quedar scrolleado: el shell es `h-dvh` +
     * `overflow-hidden` (scrollea el `<main>` de adentro), así que cualquier
     * `scrollY ≠ 0` es un estado espurio del browser y es una causa conocida de
     * que los `fixed` queden corridos. **No** se toca mientras hay un campo
     * enfocado: ahí el browser scrollea a propósito, para mostrar el campo por
     * encima del teclado.
     */
    const saneadoElScroll = () => {
      if (window.scrollY === 0) return;
      const activo = document.activeElement;
      const editando =
        activo instanceof HTMLElement &&
        (activo.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(activo.tagName));
      if (!editando) window.scrollTo(0, 0);
    };

    const revisar = () => {
      const vv = window.visualViewport;
      const escala = vv?.scale ?? 1;
      // Bordes VISIBLES en las mismas coordenadas que `getBoundingClientRect()`.
      const altoVisible = vv && vv.height > 0 ? vv.height : window.innerHeight;
      const bordeSup = vv ? vv.offsetTop : 0;
      const bordeInf = (vv ? vv.offsetTop : 0) + altoVisible;

      const nav = document.querySelector<HTMLElement>("[data-barra-nav]");
      const top = document.querySelector<HTMLElement>("[data-topbar]");

      /**
       * ⚠️ Con **zoom nativo** (`scale ≠ 1`) no se corrige: las coordenadas del
       * `visualViewport` y las del `getBoundingClientRect` dejan de ser comparables
       * y en iOS el `visualViewport` puede quedar **viejo** después del pinch ⇒ una
       * medición mala quedaba aplicada hasta reiniciar la app (comprobado en el
       * celular el 2026-10-04). El pinch nativo se bloquea en
       * `components/layout/zoom-contenido.tsx`; acá sólo se intenta **re-enganchar**
       * el `fixed` que el motor haya dejado colgado.
       */
      if (Math.abs(escala - 1) > 0.001) {
        if (nav) reenganchar(nav);
        if (top) reenganchar(top);
        return;
      }

      // ── Barra inferior ──
      if (nav) {
        const r = nav.getBoundingClientRect();
        // `bottom: var(--fp-desfase-inferior)` ⇒ el borde medido ya incluye lo
        // aplicado: se descuenta para obtener la posición “base” sin compensar.
        const nuevo = Math.round(r.bottom + aplicadoInf - bordeInf);
        if (plausible(nuevo) && nuevo !== aplicadoInf) {
          aplicadoInf = nuevo;
          escribir("--fp-desfase-inferior", nuevo);
        } else if (
          aplicadoInf === 0 &&
          Math.abs(r.bottom - window.innerHeight) > 1
        ) {
          // Sin compensación nuestra y, aun así, el `fixed` no está en el borde del
          // layout ⇒ lo dejó corrido el motor (bug de iOS): se re-engancha.
          reenganchar(nav);
        }
      }

      // ── Barra superior (mismo fenómeno, mismo mecanismo) ──
      if (top) {
        const r = top.getBoundingClientRect();
        const nuevo = Math.round(bordeSup - (r.top - aplicadoSup));
        if (plausible(nuevo) && nuevo !== aplicadoSup) {
          aplicadoSup = nuevo;
          escribir("--fp-desfase-superior", nuevo);
        } else if (aplicadoSup === 0 && Math.abs(r.top) > 1) {
          reenganchar(top);
        }
      }
    };

    /**
     * Revisa ahora y en una **ráfaga corta**: los estados que rompen el anclaje
     * (teclado, barra del navegador, pellizco) se estabilizan después del evento,
     * y una sola pasada inmediata mide el estado intermedio.
     */
    const programar = () => {
      for (const t of timers) window.clearTimeout(t);
      timers.length = 0;
      saneadoElScroll();
      revisar();
      for (const ms of [150, 500, 1200]) {
        timers.push(window.setTimeout(revisar, ms));
      }
    };

    const vv = window.visualViewport;
    window.addEventListener("resize", programar);
    window.addEventListener("scroll", programar);
    window.addEventListener("pageshow", programar);
    window.addEventListener("focusin", programar);
    window.addEventListener("focusout", programar);
    window.addEventListener("orientationchange", programar);
    document.addEventListener("visibilitychange", programar);
    vv?.addEventListener("resize", programar);
    vv?.addEventListener("scroll", programar);

    // Red de seguridad: hay estados que se traban **sin** disparar ningún evento
    // (era el caso reportado: sólo se arreglaba reiniciando la app). Un chequeo
    // perezoso cada 2 s —una medición y una resta— lo deja autocorregido.
    const vigilante = window.setInterval(() => {
      if (document.visibilityState === "visible") revisar();
    }, 2000);

    programar();

    return () => {
      for (const t of timers) window.clearTimeout(t);
      window.clearInterval(vigilante);
      window.removeEventListener("resize", programar);
      window.removeEventListener("scroll", programar);
      window.removeEventListener("pageshow", programar);
      window.removeEventListener("focusin", programar);
      window.removeEventListener("focusout", programar);
      window.removeEventListener("orientationchange", programar);
      document.removeEventListener("visibilitychange", programar);
      vv?.removeEventListener("resize", programar);
      vv?.removeEventListener("scroll", programar);
    };
  }, []);

  return null;
}
