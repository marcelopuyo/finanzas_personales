"use client";

import { useEffect, useState } from "react";

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
 * 🔧 **Borrar este archivo y su `<DiagBarras />` en `app-layout.tsx` cuando el bug
 * quede resuelto**: no forma parte de la app.
 */
export function DiagBarras() {
  const [visible, setVisible] = useState(false);
  // Arranca **minimizado**: así no tapa la interfaz mientras se reproduce el bug.
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState<[string, string][]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [copiado, setCopiado] = useState(false);
  /** Versión/commit publicada (`/version.json`), para saber qué build corre. */
  const [version, setVersion] = useState("?");
  /** ¿Está puesto el fondo magenta de prueba? (ver `pintarFondo`). */
  const [pintado, setPintado] = useState(false);
  /**
   * Cronología de eventos (`focusin`, `focusout`, `resize`…). Es lo que dice
   * **en qué momento exacto** se pierde la altura: si baja al enfocar y no vuelve
   * al cerrar el teclado, el motor nunca avisó de la restauración.
   */
  const [logEv, setLogEv] = useState<string[]>([]);

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
    const t = setTimeout(() => setVisible(encender), 0);
    return () => clearTimeout(t);
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
        ["desfase NAV (medido)", rn ? `${Math.round(rn.bottom - window.innerHeight)}` : "?"],
        ["safe-area-inset-bottom", medirSafeArea()],
        ["userAgent", navigator.userAgent.slice(0, 110)],
      ]);
    };

    medir();
    const t = setInterval(medir, 500);

    /** Deja una línea por evento, con la altura del momento. */
    const anotar = (etiqueta: string) => {
      const vv = window.visualViewport;
      const hora = new Date().toLocaleTimeString();
      setLogEv((l) =>
        [
          ...l,
          `${hora} ${etiqueta} · innerH=${window.innerHeight} clientH=${document.documentElement.clientHeight} vv=${vv ? Math.round(vv.height) : "-"}`,
        ].slice(-40)
      );
    };
    const alFocusIn = () => anotar(`focusin ${document.activeElement?.tagName ?? "?"}`);
    const alFocusOut = () => anotar("focusout");
    const alResize = () => anotar("resize");

    for (const ev of ["resize", "scroll", "focusin", "focusout", "orientationchange"]) {
      window.addEventListener(ev, medir);
    }
    window.visualViewport?.addEventListener("resize", medir);
    window.visualViewport?.addEventListener("scroll", medir);
    window.addEventListener("focusin", alFocusIn);
    window.addEventListener("focusout", alFocusOut);
    window.addEventListener("resize", alResize);
    window.addEventListener("orientationchange", alResize);
    window.visualViewport?.addEventListener("resize", alResize);
    return () => {
      clearInterval(t);
      for (const ev of ["resize", "scroll", "focusin", "focusout", "orientationchange"]) {
        window.removeEventListener(ev, medir);
      }
      window.visualViewport?.removeEventListener("resize", medir);
      window.visualViewport?.removeEventListener("scroll", medir);
      window.removeEventListener("focusin", alFocusIn);
      window.removeEventListener("focusout", alFocusOut);
      window.removeEventListener("resize", alResize);
      window.removeEventListener("orientationchange", alResize);
      window.visualViewport?.removeEventListener("resize", alResize);
    };
  }, [visible, version]);

  if (!visible) return null;

  const nav = () => document.querySelector<HTMLElement>("[data-barra-nav]");
  const linea = () => {
    const n = nav();
    const r = n?.getBoundingClientRect();
    return r ? `bottom=${Math.round(r.bottom)} h=${Math.round(r.height)}` : "sin nav";
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

  const copiar = () => {
    const texto = [
      ...datos.map(([k, v]) => `${k}: ${v}`),
      ...log,
      ...logEv,
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

  /**
   * Prueba clave para decidir si hay algo que arreglar por CSS: pinta de magenta
   * `<html>` y `<body>`. Si la franja de abajo **también** se pone magenta, esa
   * zona es nuestra y se puede cubrir; si la franja **queda igual**, el recorte lo
   * hizo la app instalada (fuera del alcance del CSS).
   */
  const pintarFondo = (on: boolean) => {
    document.documentElement.style.background = on ? "#ff00ff" : "";
    document.body.style.background = on ? "#ff00ff" : "";
    setPintado(on);
  };

  // Minimizado: una pestañita al costado, para poder interactuar con la app.
  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Mostrar diagnóstico de barras"
        className="fixed right-0 top-1/2 z-100 -translate-y-1/2 rounded-l border border-r-0 border-danger bg-background px-0.5 py-2 text-[9px] font-bold text-danger"
        style={{ writingMode: "vertical-rl" }}
      >
        DIAG
      </button>
    );
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-100 max-h-[45vh] overflow-auto border-b border-danger bg-background p-2 text-[10px] leading-tight shadow-lg"
      // En la PWA el contenido pasa por debajo de la barra de estado del teléfono:
      // sin este margen los botones de arriba quedaban tapados y no se podían tocar.
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
    >
      <div className="mb-1 flex items-center gap-2">
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
          onClick={() => setAbierto(false)}
          className="ml-auto rounded border border-border px-2 py-0.5 text-[10px]"
        >
          minimizar
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
          onClick={() => pintarFondo(!pintado)}
          className="rounded border border-danger bg-danger/10 px-1.5 py-1 text-[10px] font-bold text-danger"
        >
          {pintado ? "quitar magenta" : "pintar fondo magenta"}
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded border border-danger bg-danger/10 px-1.5 py-1 text-[10px] font-bold text-danger"
        >
          recargar la app
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
