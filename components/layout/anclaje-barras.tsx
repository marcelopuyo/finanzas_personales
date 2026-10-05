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
 * ✅ La corrección se **calcula desde el borde visible** (`visualViewport.offsetTop`
 * / `height`, la única fuente que refleja el estado real) y se publica en dos
 * variables CSS que consumen las barras (`--fp-desfase-superior` /
 * `--fp-desfase-inferior`). Cuando **no hay ningún campo enfocado** el teclado está
 * cerrado y el borde visible es, sin discusión, el del layout: ahí **no** se
 * consulta el `visualViewport`.
 *
 * ⚠️ En el caso normal las dos variables valen `0px` ⇒ **cero cambios** respecto
 * del comportamiento actual. Sólo se escribe cuando el valor cambia.
 *
 * 🔑 **Teclado (2026-10-04)**: en iOS, al **cerrar** el teclado el `visualViewport`
 * puede quedar **viejo** (sigue reportando el alto con teclado) y la barra quedaba
 * arriba hasta reiniciar la app. Por eso, **sin campo enfocado** (con una breve
 * histéresis para no parpadear al saltar entre campos), la barra va al borde del
 * layout y, si el motor la dejó pintada donde estaba, se **re-engancha**.
 */
export function AnclajeBarras() {
  useEffect(() => {
    const raiz = document.documentElement;
    /** Desfases aplicados hoy (para no escribir la variable si no cambió). */
    let aplicadoSup = 0;
    let aplicadoInf = 0;
    /**
     * Momento del **último cambio de foco de un campo**. El teclado tarda en
     * abrir/cerrar: sin esto, un `focusout` entre dos campos (con el teclado
     * todavía abierto) se leería como “teclado cerrado” y la barra bajaría y
     * subiría. Ver `revisar`.
     */
    let ultimoCampo = 0;
    /** ¿En la pasada anterior se creía que el teclado podía estar abierto? */
    let conTecladoAntes = false;
    /** Timers del “asentamiento” (los estados de estos bugs tardan en estabilizar). */
    const timers: number[] = [];

    /** ¿Ese elemento es un campo que abre el teclado en pantalla? */
    const editable = (el: Element | null) =>
      el instanceof HTMLElement &&
      (el.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

    /**
     * **Re-enganche** de un `fixed` que el motor dejó “colgado” (bug conocido de
     * iOS después del teclado o de un pinch): sacarlo y volver a ponerlo en el
     * layout **sincrónicamente** (sin `display` intermedio visible) obliga al
     * compositor a volver a pintarlo en su posición. Va rate-limited: es un parche
     * de último recurso, no parte del cálculo normal.
     */
    const ultimoReenganche = new WeakMap<HTMLElement, number>();
    const reenganchar = (el: HTMLElement) => {
      const ahora = Date.now();
      if (ahora - (ultimoReenganche.get(el) ?? 0) < 1200) return;
      ultimoReenganche.set(el, ahora);
      const previo = el.style.display;
      el.style.display = "none";
      void el.offsetHeight;
      el.style.display = previo;
      void el.offsetHeight;
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
      if (!editable(document.activeElement)) window.scrollTo(0, 0);
    };

    /**
     * **“Sanar” el zoom nativo pegado** (best effort; §221). iOS **no** expone
     * ninguna API para volver a `scale = 1` (es de sólo lectura). Lo único que
     * funciona —según las implementaciones de referencia— es **mutar el
     * `<meta viewport>`**: obliga a WebKit a re-parsear y re-aplicar la escala
     * inicial; se acompaña con `scrollTo(0,0)` y un reflow. No se ejecuta con un
     * campo enfocado (ahí el zoom puede ser intencional) y va rate-limited.
     */
    let ultimoSaneo = 0;
    const sanarZoomNativo = () => {
      if (editable(document.activeElement)) return;
      const ahora = Date.now();
      if (ahora - ultimoSaneo < 1000) return;
      ultimoSaneo = ahora;
      const meta = document.querySelector<HTMLMetaElement>(
        'meta[name="viewport"]'
      );
      if (!meta) return;
      const original = meta.getAttribute("content") ?? "";
      meta.setAttribute(
        "content",
        /maximum-scale=[\d.]+/.test(original)
          ? original.replace(/maximum-scale=[\d.]+/, "maximum-scale=5")
          : `${original}, maximum-scale=5`
      );
      requestAnimationFrame(() => {
        meta.setAttribute("content", original);
        void document.body.offsetHeight;
        window.scrollTo(0, 0);
      });
    };

    const revisar = () => {
      const vv = window.visualViewport;
      const escala = vv?.scale ?? 1;
      const nav = document.querySelector<HTMLElement>("[data-barra-nav]");
      const top = document.querySelector<HTMLElement>("[data-topbar]");

      /**
       * ⚠️ Con **zoom nativo** (`scale ≠ 1`) no se corrige: las coordenadas del
       * `visualViewport` dejan de ser comparables y en iOS pueden quedar **viejas**
       * ⇒ una medición mala quedaría aplicada hasta reiniciar la app (comprobado en
       * el celular el 2026-10-04). El pinch nativo se bloquea en
       * `components/layout/zoom-contenido.tsx`; acá sólo se intenta **re-enganchar**
       * el `fixed` que el motor haya dejado colgado.
       */
      if (Math.abs(escala - 1) > 0.001) {
        // Zoom nativo pegado (iOS no lo revierte solo): se intenta “sanar” y, si el
        // motor dejó los `fixed` colgados, re-engancharlos.
        sanarZoomNativo();
        if (nav) reenganchar(nav);
        if (top) reenganchar(top);
        return;
      }

      const altoLayout = window.innerHeight;
      const enfocado = editable(document.activeElement);
      if (enfocado) ultimoCampo = Date.now();
      /**
       * 🔑 **La clave del bug del teclado**: en iOS el `visualViewport` puede quedar
       * **viejo** después de cerrarlo (sigue reportando el alto con teclado) y
       * entonces la corrección dejaba la barra **arriba para siempre** (sólo se
       * arreglaba reiniciando la app). Por eso, **sin campo enfocado** y pasado el
       * asentamiento, la conclusión es firme: el teclado está cerrado ⇒ el borde
       * visible es el del layout, **aunque** el `visualViewport` diga otra cosa. La
       * histéresis (`ultimoCampo`) evita el parpadeo al saltar entre campos.
       */
      const puedeEstarConTeclado =
        enfocado || Date.now() - ultimoCampo < 400;

      // Borde visible OBJETIVO (en coordenadas del layout, como `getBoundingClientRect`).
      let bordeSup = 0;
      let bordeInf = altoLayout;
      if (puedeEstarConTeclado && vv && vv.height > 0) {
        bordeSup = Math.max(0, vv.offsetTop);
        bordeInf = vv.offsetTop + vv.height;
      }

      /** ¿La corrección es plausible? (evita saltos por mediciones a mitad de animación). */
      const plausible = (v: number) =>
        Number.isFinite(v) && Math.abs(v) <= altoLayout;

      // ¿El teclado se acaba de cerrar? ⇒ hay que bajar la barra sí o sí y, por si
      // el motor la dejó pintada donde estaba, re-engancharla.
      const volvioAlBorde = conTecladoAntes && !puedeEstarConTeclado;
      conTecladoAntes = puedeEstarConTeclado;

      // ── Barra inferior ──
      if (nav) {
        // Se mide la posición real y se descuenta lo ya aplicado: la corrección
        // autocorrige también si el motor dejó el `fixed` corrido (bug de iOS).
        const r = nav.getBoundingClientRect();
        const nuevo = Math.round(r.bottom + aplicadoInf - bordeInf);
        if (plausible(nuevo) && nuevo !== aplicadoInf) {
          aplicadoInf = nuevo;
          escribir("--fp-desfase-inferior", nuevo);
        }
        if (volvioAlBorde) reenganchar(nav);
      }

      // ── Barra superior (mismo fenómeno, mismo mecanismo) ──
      if (top) {
        const r = top.getBoundingClientRect();
        const nuevo = Math.round(bordeSup - (r.top - aplicadoSup));
        if (plausible(nuevo) && nuevo !== aplicadoSup) {
          aplicadoSup = nuevo;
          escribir("--fp-desfase-superior", nuevo);
        }
        if (volvioAlBorde) reenganchar(top);
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
    // `focusout` arranca la histéresis (ver `revisar`) antes de reprogramar.
    const alPerderCampo = () => {
      ultimoCampo = Date.now();
      programar();
    };
    document.addEventListener("focusout", alPerderCampo);
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
      document.removeEventListener("focusout", alPerderCampo);
      window.removeEventListener("orientationchange", programar);
      document.removeEventListener("visibilitychange", programar);
      vv?.removeEventListener("resize", programar);
      vv?.removeEventListener("scroll", programar);
    };
  }, []);

  return null;
}
