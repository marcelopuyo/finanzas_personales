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
     * 🔑 **Franja de la app instalada** (bug de iOS, WebKit 317749).
     *
     * En la PWA instalada, tras usar el teclado el *layout viewport* de iOS queda
     * **más corto que la pantalla y no se recupera** (probado en el celular:
     * ninguna de las salidas conocidas —re-medir, ciclo de teclado, recargar— lo
     * devuelve; sólo reiniciar la app). Medido: en una pantalla de 812 px el área
     * útil queda en 660 (`100dvh` / `100svh`), pero **`100lvh` sigue sabiendo el
     * alto real** (706).
     *
     * Esa franja la pinta el **fondo del documento**, no un elemento nuestro: el
     * faldón de la barra (`bg-sidebar`) y el contenido **no** se ven ahí. Se
     * comprobó en el celular pintando el fondo de magenta: la franja se pinta,
     * el contenido no (o sea que la franja está fuera del layout, pero dentro del
     * área que el motor pinta).
     *
     * Como no se puede poner contenido ahí, se pinta la franja **con el color de
     * la barra**: el conjunto se lee como una sola barra pegada al borde.
     *
     * ⚠️ Desde que el shell se estira a `100lvh` (`globals.css`, §224) esta franja
     * ya no queda descubierta en el iPhone del caso: esto queda como **red de
     * seguridad** para un dispositivo donde `lvh` no mida el alto real.
     *
     * La reserva se mide en CSS puro (`100lvh - 100svh`) y sólo en la PWA
     * instalada: en Safari el navegador reserva su propia barra a propósito, y ahí
     * la franja no existe. Sano = 0 ⇒ no se pinta nada (comportamiento de siempre).
     */
    const COLOR_FRANJA =
      "color-mix(in srgb, var(--sidebar) 78%, var(--background))";
    const esInstalada = () =>
      window.matchMedia("(display-mode: standalone)").matches;
    /** Alto de una caja de prueba (fuerza una lectura de layout por llamada). */
    const medirPx = (css: string) => {
      const d = document.createElement("div");
      d.style.cssText = `position:fixed;top:0;left:0;visibility:hidden;${css}`;
      document.body.appendChild(d);
      const h = Math.round(d.getBoundingClientRect().height);
      d.remove();
      return h;
    };
    let reservaCache = 0;
    let reservaMedidaEn = 0;
    /** Espacio que el motor reserva y no usa (`100lvh - 100svh`). Cacheado 1 s. */
    const reserva = () => {
      const ahora = Date.now();
      if (ahora - reservaMedidaEn > 1000) {
        reservaMedidaEn = ahora;
        reservaCache = esInstalada()
          ? medirPx("width:0;height:100lvh") - medirPx("width:0;height:100svh")
          : 0;
      }
      return reservaCache;
    };
    let franjaPintada = false;
    const pintarFranja = (activo: boolean) => {
      if (activo === franjaPintada) return;
      franjaPintada = activo;
      const color = activo ? COLOR_FRANJA : "";
      raiz.style.background = color;
      document.body.style.background = color;
    };
    /** Pinta o despinta la franja según lo que el motor reserve hoy. */
    const ajustarFranja = () => pintarFranja(reserva() > 4);

    /**
     * Marca en `<html>` que hay un teclado en pantalla. Con el teclado arriba el
     * shell vuelve a `dvh` (ver `globals.css`): ahí el layout **sí** coincide con
     * el teclado, y si el shell quedara en `100lvh` desbordaría y la página
     * scrollearía mientras se escribe.
     */
    let tecladoMarcado = false;
    const marcarTeclado = (activo: boolean) => {
      if (activo === tecladoMarcado) return;
      tecladoMarcado = activo;
      if (activo) raiz.dataset.teclado = "1";
      else delete raiz.dataset.teclado;
    };

    /**
     * **Modo “zoom nativo”** (best effort; §221). iOS **no** expone ninguna API para
     * volver a `scale = 1` (es de sólo lectura) y, mientras la app mantiene el
     * bloqueo de gestos (§219), el usuario **no puede pellizcar para salir**.
     *
     * Cuando se detecta `scale ≠ 1` se **relaja** el bloqueo:
     * - el `<meta viewport>` pasa a `maximum-scale=5, user-scalable=yes` (además de
     *   forzar a WebKit a re-parsear y re-aplicar la escala inicial), y
     * - se marca `<html data-gestos-nativos>` para que el CSS devuelva el
     *   `touch-action` a `auto` en el shell (ver `globals.css`).
     *
     * Al volver a `scale = 1` se restaura todo.
     */
    let metaZoomActivo = false;
    let metaOriginal = "";
    const modoZoomNativo = (activo: boolean) => {
      const meta = document.querySelector<HTMLMetaElement>(
        'meta[name="viewport"]'
      );
      if (activo && !metaZoomActivo && meta) {
        metaOriginal = meta.getAttribute("content") ?? "";
        meta.setAttribute(
          "content",
          "width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover"
        );
        metaZoomActivo = true;
        raiz.dataset.gestosNativos = "1";
        window.scrollTo(0, 0);
      } else if (!activo && metaZoomActivo && meta) {
        meta.setAttribute("content", metaOriginal);
        metaZoomActivo = false;
        delete raiz.dataset.gestosNativos;
      }
    };

    const revisar = () => {
      const vv = window.visualViewport;
      const escala = vv?.scale ?? 1;
      const nav = document.querySelector<HTMLElement>("[data-barra-nav]");
      const top = document.querySelector<HTMLElement>("[data-topbar]");

      // La franja la pinta el fondo del documento: se ajusta siempre, también con
      // zoom nativo (no depende de medir la barra).
      ajustarFranja();

      /**
       * ⚠️ Con **zoom nativo** (`scale ≠ 1`) no se corrige: las coordenadas del
       * `visualViewport` dejan de ser comparables y en iOS pueden quedar **viejas**
       * ⇒ una medición mala quedaría aplicada hasta reiniciar la app (comprobado en
       * el celular el 2026-10-04). El pinch nativo se bloquea en
       * `components/layout/zoom-contenido.tsx`; acá sólo se intenta **re-enganchar**
       * el `fixed` que el motor haya dejado colgado.
       */
      if (Math.abs(escala - 1) > 0.001) {
        // Zoom nativo pegado: se libera el bloqueo de gestos (para que el usuario
        // pueda pellizcar y salir) y, si el motor dejó los `fixed` colgados, se
        // re-enganchan.
        modoZoomNativo(true);
        if (nav) reenganchar(nav);
        if (top) reenganchar(top);
        return;
      }

      // De vuelta en escala 1: se restaura el bloqueo de gestos de §219.
      modoZoomNativo(false);

      const altoLayout = window.innerHeight;

      /**
       * 🔑 **Borde inferior de referencia: el del shell, no el del viewport.**
       *
       * En la PWA instalada iOS deja el layout más corto que la pantalla (§224) y
       * el shell se estira al alto real por CSS (`100lvh`, ver `globals.css`): los
       * `fixed` de adentro se posicionan contra el shell, así que su borde es el
       * borde real de la pantalla. Si acá se midiera contra `innerHeight` (660), la
       * corrección "arreglaría" la barra subiéndola 46 px y volvería la franja.
       * En un navegador el shell es `h-dvh` y los dos bordes coinciden.
       */
      const shell = document.querySelector<HTMLElement>("[data-app-shell]");
      const bordeShell = shell
        ? Math.round(shell.getBoundingClientRect().height)
        : altoLayout;

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
      // Con el teclado arriba el shell vuelve a `dvh` (ver `globals.css`): ahí el
      // borde de referencia es el del viewport otra vez.
      marcarTeclado(puedeEstarConTeclado);

      // Borde visible OBJETIVO (en coordenadas del layout, como `getBoundingClientRect`).
      let bordeSup = 0;
      let bordeInf = bordeShell;
      if (puedeEstarConTeclado && vv && vv.height > 0) {
        bordeSup = Math.max(0, vv.offsetTop);
        bordeInf = vv.offsetTop + vv.height;
      }

      /** ¿La corrección es plausible? (evita saltos por mediciones a mitad de animación). */
      const limiteDesfase = Math.max(altoLayout, bordeShell);
      const plausible = (v: number) =>
        Number.isFinite(v) && Math.abs(v) <= limiteDesfase;

      // ¿El teclado se acaba de cerrar? ⇒ hay que bajar la barra sí o sí y, por si
      // el motor la dejó pintada donde estaba, re-engancharla.
      const volvioAlBorde = conTecladoAntes && !puedeEstarConTeclado;
      conTecladoAntes = puedeEstarConTeclado;

      // ── Barra inferior ──
      if (nav) {
        // Se mide la posición real y se descuenta lo ya aplicado: la corrección
        // autocorrige también si el motor dejó el `fixed` corrido (bug de iOS).
        //
        // ⚠️ Sólo se **sube** la barra (`Math.max(0, …)`): moverla hacia afuera del
        // layout viewport no está garantizado que se pinte —el motor recorta lo que
        // se posiciona fuera de él, comprobado con una franja de prueba en el
        // celular (§224)—. Cuando hay que bajarla, el trabajo lo hace el shell
        // estirado a `100lvh` (ver `globals.css`), no el desfase.
        const r = nav.getBoundingClientRect();
        const nuevo = Math.max(0, Math.round(r.bottom + aplicadoInf - bordeInf));
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
      pintarFranja(false);
      marcarTeclado(false);
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
