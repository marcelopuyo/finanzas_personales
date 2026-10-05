"use client";

import { useEffect, useRef, useState } from "react";

/** Clave de `localStorage`: deja el panel encendido también en la **PWA instalada**
 *  (standalone), donde no hay barra de direcciones para escribir `?diag=1`. */
const CLAVE_DIAG = "fp_diag_barras";

/**
 * ⚠️ **TEMPORAL — panel de diagnóstico del anclaje de las barras** (2026-10-04).
 *
 * Para qué: el síntoma *“la barra inferior queda despegada del borde y sólo se
 * arregla reiniciando la app”* pasa **sólo en un teléfono** y no se puede
 * reproducir en el navegador de escritorio. En vez de seguir adivinando, este
 * panel muestra **los números reales del dispositivo** (`visualViewport` vs
 * `getBoundingClientRect`) y ofrece **botones de “kick”** para descubrir cuál
 * re-engancha el `fixed` en ese motor.
 *
 * Se abre agregando **`?diag=1`** a cualquier pantalla (ej.
 * `https://…/dashboard?diag=1`). **`?diag=0`** lo apaga (y lo recuerda).
 *
 * ⚠️ Por ahora se muestra **solo en la PWA instalada** (standalone): en iOS el
 * almacenamiento de la PWA está separado del navegador ⇒ el `?diag=1` puesto en
 * Safari **no llega** a la app del acceso directo (y ahí no hay barra de
 * direcciones para escribirlo). Con `?diag=1` también se puede abrir en el
 * navegador; `?diag=0` lo apaga y lo recuerda.
 *
 * El panel arranca **minimizado**: se toca para expandir y se puede **copiar todo**
 * al portapapeles.
 *
 * 🔧 **No está montado** (2026-10-05, al cerrar el caso de la barra despegada en
 * iOS): se conserva para futuras pruebas. Para usarlo, montá `<DiagBarras />` en
 * `components/layout/app-layout.tsx` y abrí la app con `?diag=1` (en la PWA
 * instalada se enciende solo). Grabación, modos y botones: ver `DeepSeek/bitacora.md`
 * §222-§225.
 */
export function DiagBarras() {
  const [visible, setVisible] = useState(false);
  /**
   * Cómo se ve el panel:
   * - `tab`: pestañita al costado (lo más discreto).
   * - `linea`: **una sola línea** con los números clave, pegada arriba. Es la
   *   forma de mirar los valores **mientras se usa la app**: no tapa el formulario,
   *   así que el bug del teclado se puede desencadenar con el panel encendido.
   * - `panel`: panel completo, con las medidas y los botones de prueba.
   *
   * Con un campo enfocado pasa solo a `linea` y, al cerrar el teclado, vuelve solo
   * a `panel` (ver `alEnfocar` / `alPerderCampo`).
   */
  const [modo, setModo] = useState<"tab" | "linea" | "panel">("tab");
  const [datos, setDatos] = useState<[string, string][]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [copiado, setCopiado] = useState(false);
  /** Versión/commit publicada (`/version.json`), para saber qué build corre. */
  const [version, setVersion] = useState("?");
  /**
   * Cronología de eventos (`focusin`, `focusout`, `resize`…). Es lo que dice
   * **en qué momento exacto** se pierde la altura: si baja al enfocar y no vuelve
   * al cerrar el teclado, el motor nunca avisó de la restauración.
   */
  const [logEv, setLogEv] = useState<string[]>([]);
  /** Espejo de `modo` para leerlo desde las escuchas del efecto (que no se re-crean). */
  const modoRef = useRef<"tab" | "linea" | "panel">("tab");
  /** ¿El panel estaba abierto cuando se empezó a escribir? (para volver solo). */
  const volverAPanel = useRef(false);
  /**
   * Cronología grabada. Se llena **siempre**, aunque el panel esté cerrado o
   * apagado: el bug se reproduce usando la app, así que no se puede depender de
   * tener el panel abierto para grabar. Va en un `ref` (sin `setState`) para no
   * re-renderizar la app ni una vez de más.
   */
  const registroRef = useRef<string[]>([]);
  /** Última muestra registrada, para no repetir las idénticas (el `tick`). */
  const ultimaFirmaRef = useRef("");

  const cambiarModo = (m: "tab" | "linea" | "panel") => {
    modoRef.current = m;
    setModo(m);
  };

  useEffect(() => {
    fetch("/version.json", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { version?: string; commit?: string }) =>
        setVersion(`${j.version ?? "?"} ${j.commit ?? ""}`.trim())
      )
      .catch(() => {});
  }, []);

  /** `env(safe-area-inset-bottom)` medido con una sonda descartable. */
  const medirSafeArea = () => {
    const d = document.createElement("div");
    d.style.cssText =
      "position:fixed;bottom:0;width:0;visibility:hidden;height:env(safe-area-inset-bottom)";
    document.body.appendChild(d);
    const h = d.getBoundingClientRect().height;
    d.remove();
    return `${Math.round(h)}px`;
  };

  /**
   * Alto real de una caja de prueba. Sirve para comparar **el viewport que el
   * motor cree que tiene** (`100vh`, `100dvh`, `inset:0`) contra la pantalla
   * física: si los tres miden 660 en una pantalla de 812, el recorte lo hizo el
   * motor y **ningún CSS nuestro puede pintar la franja**.
   */
  const medirAlto = (css: string) => {
    const d = document.createElement("div");
    d.style.cssText = `position:fixed;top:0;left:0;visibility:hidden;${css}`;
    document.body.appendChild(d);
    const h = Math.round(d.getBoundingClientRect().height);
    d.remove();
    return h;
  };

  // El `setState` va diferido para no dispararlo dentro del cuerpo del efecto
  // (`react-hooks/set-state-in-effect`, §114).
  //
  // ⚠️ TEMPORAL: se enciende **solo en la PWA instalada** (standalone) —que es
  // donde aparece el bug y donde no hay barra de direcciones— o con `?diag=1`.
  // `?diag=0` lo apaga y lo recuerda.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    let encender =
      window.matchMedia("(display-mode: standalone)").matches ||
      q.get("diag") === "1";
    if (q.get("diag") === "0") encender = false;
    try {
      if (encender && window.localStorage.getItem(CLAVE_DIAG) === "0") {
        encender = false;
      }
    } catch {
      /* modo privado */
    }
    const t = setTimeout(() => {
      setVisible(encender);
      // `?modo=linea|panel` abre el panel ya en ese modo (para probarlo rápido).
      const m = q.get("modo");
      if (m === "linea" || m === "panel") {
        modoRef.current = m;
        setModo(m);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  /**
   * **Grabador siempre activo** (no depende de que el panel esté visible).
   *
   * El problema se reproduce mientras se usa la app —cargar un gasto, cerrar el
   * teclado— así que el registro tiene que estar corriendo desde que arranca la
   * app. Cuando el usuario termina, abre el panel y con «copiar todo» se lleva
   * toda la cronología junta.
   *
   * Sólo escribe en un `ref`: cero re-renders mientras la app se usa.
   */
  useEffect(() => {
    /** Una muestra: los números que permiten reconstruir el caso. */
    const firma = (etiqueta: string) => {
      const vv = window.visualViewport;
      const nav = document.querySelector<HTMLElement>("[data-barra-nav]");
      const shell = document.querySelector<HTMLElement>("[data-app-shell]");
      const rn = nav?.getBoundingClientRect();
      const rs = shell?.getBoundingClientRect();
      const act = document.activeElement;
      return [
        etiqueta,
        `innerH=${window.innerHeight}`,
        `clientH=${document.documentElement.clientHeight}`,
        `vvH=${vv ? Math.round(vv.height) : "-"}`,
        `vvTop=${vv ? Math.round(vv.offsetTop) : "-"}`,
        `esc=${vv ? vv.scale.toFixed(2) : "-"}`,
        `shellH=${rs ? Math.round(rs.height) : "-"}`,
        `navB=${rn ? Math.round(rn.bottom) : "-"}`,
        `screenH=${window.screen.height}`,
        `act=${act && act !== document.body ? act.tagName : "-"}`,
      ].join(" ");
    };

    const registrar = (etiqueta: string, forzar = false) => {
      const f = firma(etiqueta);
      if (!forzar && f === ultimaFirmaRef.current) return;
      ultimaFirmaRef.current = f;
      registroRef.current.push(`${new Date().toLocaleTimeString()} ${f}`);
      // Tope: la app puede quedar abierta horas.
      if (registroRef.current.length > 400) registroRef.current.shift();
    };

    registrar("arranque", true);
    const alFocusIn = () =>
      registrar(`focusin ${document.activeElement?.tagName ?? "?"}`, true);
    const alFocusOut = () => registrar("focusout", true);
    const alResize = () => registrar("resize", true);
    const alOrient = () => registrar("orientationchange", true);
    const alVis = () => registrar(`visibility ${document.visibilityState}`, true);
    const alPageshow = () => registrar("pageshow", true);
    const alVv = () => registrar("vv", true);

    // `focusin`/`focusout` en captura: interesa aunque alguien corte la propagación.
    window.addEventListener("focusin", alFocusIn, true);
    window.addEventListener("focusout", alFocusOut, true);
    window.addEventListener("resize", alResize);
    window.addEventListener("orientationchange", alOrient);
    document.addEventListener("visibilitychange", alVis);
    window.addEventListener("pageshow", alPageshow);
    window.visualViewport?.addEventListener("resize", alVv);
    window.visualViewport?.addEventListener("scroll", alVv);
    // Muestreo perezoso: detecta cambios que **no** disparan ningún evento.
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") registrar("tick");
    }, 2000);

    return () => {
      window.clearInterval(t);
      window.removeEventListener("focusin", alFocusIn, true);
      window.removeEventListener("focusout", alFocusOut, true);
      window.removeEventListener("resize", alResize);
      window.removeEventListener("orientationchange", alOrient);
      document.removeEventListener("visibilitychange", alVis);
      window.removeEventListener("pageshow", alPageshow);
      window.visualViewport?.removeEventListener("resize", alVv);
      window.visualViewport?.removeEventListener("scroll", alVv);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;

    const medir = () => {
      const nav = document.querySelector<HTMLElement>("[data-barra-nav]");
      const top = document.querySelector<HTMLElement>("[data-topbar]");
      const main = document.querySelector<HTMLElement>("main");
      const shell = document.querySelector<HTMLElement>("[data-app-shell]");
      const vv = window.visualViewport;
      const rn = nav?.getBoundingClientRect();
      const rt = top?.getBoundingClientRect();
      const cs = nav ? getComputedStyle(nav) : null;
      const raiz = document.documentElement;
      const campo = document.querySelector<HTMLElement>(
        'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]), textarea, select'
      );
      const activo = document.activeElement;
      setDatos([
        ["version", version],
        ["standalone", String(window.matchMedia("(display-mode: standalone)").matches)],
        ["campo font-size", campo ? getComputedStyle(campo).fontSize : "?"],
        ["active (tag / font)", activo ? `${activo.tagName} / ${getComputedStyle(activo).fontSize}` : "?"],
        ["innerH / clientH", `${window.innerHeight} / ${raiz.clientHeight}`],
        ["innerW / clientW / screen.w", `${window.innerWidth} / ${raiz.clientWidth} / ${window.screen.width}`],
        ["vv.w x vv.h", vv ? `${Math.round(vv.width)} x ${Math.round(vv.height)}` : "sin visualViewport"],
        ["100vh / 100dvh", `${medirAlto("width:0;height:100vh")} / ${medirAlto("width:0;height:100dvh")}`],
        ["100svh / 100lvh", `${medirAlto("width:0;height:100svh")} / ${medirAlto("width:0;height:100lvh")}`],
        [
          "reserva (100lvh - 100svh)",
          `${medirAlto("width:0;height:100lvh") - medirAlto("width:0;height:100svh")}`,
        ],
        ["caja fixed inset:0", `${medirAlto("inset:0")}`],
        ["html scrollH / body scrollH", `${raiz.scrollHeight} / ${document.body.scrollHeight}`],
        ["hueco abajo (screen - innerH)", `${window.screen.height - window.innerHeight}`],
        ["app-shell h / bottom", shell ? `${Math.round(shell.getBoundingClientRect().height)} / ${Math.round(shell.getBoundingClientRect().bottom)}` : "?"],
        ["screen.h / availH", `${window.screen.height} / ${window.screen.availHeight}`],
        ["vv.h / vv.top / scale", vv ? `${Math.round(vv.height)} / ${Math.round(vv.offsetTop)} / ${vv.scale}` : "sin visualViewport"],
        ["vv.pageTop / vv.pageLeft", vv ? `${Math.round(vv.pageTop)} / ${Math.round(vv.pageLeft)}` : "sin visualViewport"],
        ["scrollY / main.scrollTop", `${window.scrollY} / ${main?.scrollTop ?? "?"}`],
        ["nav bottom / h", `${rn ? Math.round(rn.bottom) : "?"} / ${rn ? Math.round(rn.height) : "?"}`],
        ["nav top rect / offsetH", `${rn ? Math.round(rn.top) : "?"} / ${nav?.offsetHeight ?? "?"}`],
        ["nav css bottom / top", `${cs?.bottom ?? "?"} / ${cs?.top ?? "?"}`],
        ["desfase aplicado (inferior)", raiz.style.getPropertyValue("--fp-desfase-inferior") || "(vacío)"],
        ["desfase aplicado (superior)", raiz.style.getPropertyValue("--fp-desfase-superior") || "(vacío)"],
        ["--fp-zoom", raiz.style.getPropertyValue("--fp-zoom") || "(vacío)"],
        ["top rect.top / h", `${rt ? Math.round(rt.top) : "?"} / ${rt ? Math.round(rt.height) : "?"}`],
        [
          "desfase NAV (shell / innerH)",
          rn
            ? `${Math.round(rn.bottom - (shell ? shell.getBoundingClientRect().height : window.innerHeight))} / ${Math.round(rn.bottom - window.innerHeight)}`
            : "?",
        ],
        ["safe-area-inset-bottom", medirSafeArea()],
        ["userAgent", navigator.userAgent.slice(0, 110)],
      ]);
    };

    /** Copia la cronología grabada (siempre activa) al estado que muestra el panel. */
    const sincronizar = () => setLogEv(registroRef.current.slice(-80));

    medir();
    sincronizar();
    const t = setInterval(() => {
      medir();
      sincronizar();
    }, 500);

    /**
     * Con un campo enfocado el panel completo **tapa el formulario** y no se puede
     * desencadenar el bug. Por eso se achica solo a una línea mientras se escribe y
     * vuelve solo al cerrar el teclado (§222).
     */
    let tVolver: number | undefined;
    const alEnfocar = () => {
      if (modoRef.current === "panel") {
        volverAPanel.current = true;
        cambiarModo("linea");
      }
    };
    const alPerderCampo = () => {
      if (tVolver !== undefined) window.clearTimeout(tVolver);
      // El teclado tarda en cerrarse: se espera antes de volver a abrir el panel.
      tVolver = window.setTimeout(() => {
        if (volverAPanel.current) {
          volverAPanel.current = false;
          cambiarModo("panel");
        }
      }, 700);
    };
    for (const ev of ["resize", "scroll", "focusin", "focusout", "orientationchange"]) {
      window.addEventListener(ev, medir);
    }
    window.visualViewport?.addEventListener("resize", medir);
    window.visualViewport?.addEventListener("scroll", medir);
    window.addEventListener("focusin", alEnfocar);
    window.addEventListener("focusout", alPerderCampo);
    return () => {
      clearInterval(t);
      if (tVolver !== undefined) window.clearTimeout(tVolver);
      for (const ev of ["resize", "scroll", "focusin", "focusout", "orientationchange"]) {
        window.removeEventListener(ev, medir);
      }
      window.visualViewport?.removeEventListener("resize", medir);
      window.visualViewport?.removeEventListener("scroll", medir);
      window.removeEventListener("focusin", alEnfocar);
      window.removeEventListener("focusout", alPerderCampo);
    };
  }, [visible, version]);

  if (!visible) return null;

  const nav = () => document.querySelector<HTMLElement>("[data-barra-nav]");
  const linea = () => {
    const n = nav();
    const r = n?.getBoundingClientRect();
    const vv = window.visualViewport;
    return `innerH=${window.innerHeight} clientH=${document.documentElement.clientHeight} vvH=${vv ? Math.round(vv.height) : "-"} navBottom=${r ? Math.round(r.bottom) : "?"}`;
  };

  /** Ejecuta un “kick” y registra el antes/después de la barra. */
  const probar = (nombre: string, fn: () => void) => {
    const antes = linea();
    try {
      fn();
    } catch (e) {
      setLog((l) => [`${nombre}: ERROR ${String(e)}`, ...l].slice(0, 14));
      return;
    }
    const despues = linea();
    setLog((l) => [`${nombre}: ${antes} → ${despues}`, ...l].slice(0, 14));
  };

  const kicks: [string, () => void][] = [
    [
      "vars a 0",
      () => {
        const raiz = document.documentElement;
        raiz.style.setProperty("--fp-desfase-inferior", "0px");
        raiz.style.setProperty("--fp-desfase-superior", "0px");
      },
    ],
    [
      "reenganche transform",
      () => {
        const n = nav();
        if (!n) return;
        n.style.transform = "translateZ(0)";
        void n.offsetHeight;
        n.style.transform = "";
      },
    ],
    [
      "toggle display",
      () => {
        const n = nav();
        if (!n) return;
        n.style.display = "none";
        void n.offsetHeight;
        n.style.display = "";
      },
    ],
    [
      "toggle position",
      () => {
        const n = nav();
        if (!n) return;
        n.style.position = "static";
        void n.offsetHeight;
        n.style.position = "fixed";
        void n.offsetHeight;
        n.style.position = "";
      },
    ],
    [
      "nudge main",
      () => {
        const m = document.querySelector<HTMLElement>("main");
        if (!m) return;
        m.scrollTop += 1;
        m.scrollTop -= 1;
      },
    ],
    [
      "nudge window",
      () => {
        window.scrollBy(0, 1);
        window.scrollBy(0, -1);
      },
    ],
    [
      "reflow body",
      () => {
        document.body.style.transform = "translateZ(0)";
        void document.body.offsetHeight;
        document.body.style.transform = "";
      },
    ],
    [
      "toggle height",
      () => {
        const n = nav();
        if (!n) return;
        const h = n.style.height;
        n.style.height = `${n.offsetHeight + 1}px`;
        void n.offsetHeight;
        n.style.height = h;
      },
    ],
  ];

  /**
   * Prueba **temporal**: aplica un cambio, deja ver el resultado 6 s y lo deshace
   * sola. Es para mirar, no para arreglar: así no se puede quedar trabada.
   */
  const probarTemporal = (
    nombre: string,
    aplicar: () => void,
    deshacer: () => void
  ) => {
    const antes = linea();
    try {
      aplicar();
    } catch (e) {
      setLog((l) => [`${nombre}: ERROR ${String(e)}`, ...l].slice(0, 14));
      return;
    }
    window.setTimeout(() => {
      const durante = linea();
      deshacer();
      window.setTimeout(() => {
        setLog((l) =>
          [`${nombre}: ${antes} → ${durante} → ${linea()}`, ...l].slice(0, 14)
        );
      }, 500);
    }, 6000);
  };

  /**
   * Prueba **temporal** del arreglo: devuelve el shell al alto del viewport (el
   * comportamiento viejo) por 6 s para poder comparar. Se deshace sola: no se
   * puede quedar trabada.
   */
  const shellDvh = () => {
    const s = document.querySelector<HTMLElement>("[data-app-shell]");
    if (!s) return;
    probarTemporal(
      "shell 100dvh (6s)",
      () => {
        s.style.height = "100dvh";
      },
      () => {
        s.style.height = "";
      }
    );
  };

  const copiar = () => {
    const texto = [
      "=== DIAG BARRAS ===",
      `copiado: ${new Date().toLocaleString()}`,
      `lineas de cronologia: ${registroRef.current.length} (tope 400)`,
      "",
      ...datos.map(([k, v]) => `${k}: ${v}`),
      "",
      "=== CRONOLOGIA (se graba siempre, tambien con el panel cerrado) ===",
      ...registroRef.current,
      "",
      "=== PRUEBAS HECHAS A MANO ===",
      ...log,
    ].join("\n");
    const p = navigator.clipboard?.writeText(texto);
    if (p) {
      p.then(
        () => {
          setCopiado(true);
          window.setTimeout(() => setCopiado(false), 1500);
        },
        () => {}
      );
    }
  };

  const apagar = () => {
    try {
      window.localStorage.setItem(CLAVE_DIAG, "0");
    } catch {
      /* modo privado */
    }
    setVisible(false);
  };

  /** Último valor medido de una fila, por nombre. */
  const dato = (clave: string) => datos.find(([k]) => k === clave)?.[1] ?? "?";

  /** Línea única: los números que importan, sin tapar el formulario. */
  const resumen = `h ${dato("innerH / clientH")} · vv ${dato("vv.h / vv.top / scale")} · nav ${dato("nav bottom / h")} · hueco ${dato("hueco abajo (screen - innerH)")}`;

  // Modo `tab`: una pestañita al costado, para poder interactuar con la app.
  if (modo === "tab") {
    return (
      <button
        type="button"
        onClick={() => cambiarModo("panel")}
        aria-label="Mostrar diagnóstico de barras"
        className="fixed right-0 top-1/2 z-100 -translate-y-1/2 rounded-l border border-r-0 border-danger bg-background px-0.5 py-2 text-[9px] font-bold text-danger"
        style={{ writingMode: "vertical-rl" }}
      >
        DIAG
      </button>
    );
  }

  /**
   * Modo `linea`: una sola franja con los números clave. Es la forma de ver los
   * valores **mientras se usa la app** (con un campo enfocado el panel se achica
   * solo a esto), así el formulario queda utilizable y el bug se puede reproducir.
   */
  if (modo === "linea") {
    return (
      <div
        className="fixed inset-x-0 top-0 z-100 flex items-center gap-1 border-b border-danger bg-background/95 px-1 py-0.5 text-[9px] leading-none"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.25rem)" }}
      >
        <span className="truncate tabular-nums text-danger">{resumen}</span>
        <button
          type="button"
          onClick={() => cambiarModo("panel")}
          className="ml-auto shrink-0 rounded border border-danger px-1 py-0.5 text-[9px] font-bold text-danger"
        >
          panel
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-100 max-h-[45vh] overflow-auto border-b border-danger bg-background p-2 text-[10px] leading-tight shadow-lg"
      // En la PWA el contenido pasa por debajo de la barra de estado del teléfono:
      // sin este margen los botones de arriba quedaban tapados y no se podían tocar.
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
    >
      <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <strong className="text-[11px] text-danger">DIAG BARRAS</strong>
        <button
          type="button"
          onClick={copiar}
          className="rounded border border-border px-2 py-0.5 text-[10px]"
        >
          {copiado ? "copiado ✓" : "copiar todo"}
        </button>
        <button
          type="button"
          onClick={() => cambiarModo("linea")}
          className="ml-auto rounded border border-border px-2 py-0.5 text-[10px]"
        >
          a una línea
        </button>
        <button
          type="button"
          onClick={() => cambiarModo("tab")}
          className="rounded border border-border px-2 py-0.5 text-[10px]"
        >
          ocultar
        </button>
        <button
          type="button"
          onClick={apagar}
          className="rounded border border-border px-2 py-0.5 text-[10px]"
        >
          apagar
        </button>
      </div>
      <div className="tabular-nums">
        {datos.map(([k, v]) => (
          <div key={k} className="break-all">
            <span className="text-subtitle">{k}: </span>
            {v}
          </div>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {kicks.map(([nombre, fn]) => (
          <button
            key={nombre}
            type="button"
            onClick={() => probar(nombre, fn)}
            className="rounded border border-border px-1.5 py-1 text-[10px]"
          >
            {nombre}
          </button>
        ))}
        <button
          type="button"
          onClick={shellDvh}
          className="rounded border border-danger bg-danger/10 px-1.5 py-1 text-[10px] font-bold text-danger"
        >
          shell 100dvh (6s)
        </button>
      </div>
      {logEv.length > 0 && (
        <div className="mt-1 border-t border-border pt-1">
          {logEv.map((l, i) => (
            <div key={i} className="tabular-nums">
              {l}
            </div>
          ))}
        </div>
      )}
      {log.length > 0 && (
        <div className="mt-1 border-t border-border pt-1">
          {log.map((l, i) => (
            <div key={i} className="tabular-nums">
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
