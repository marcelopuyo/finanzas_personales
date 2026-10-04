"use client";

import { useEffect, useState } from "react";

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
 * Se abre agregando **`?diag=1`** a cualquier pantalla del área protegida
 * (ej. `https://…/dashboard?diag=1`).
 *
 * 🔧 **Borrar este archivo y su `<DiagBarras />` en `app-layout.tsx` cuando el bug
 * quede resuelto**: no forma parte de la app.
 */
export function DiagBarras() {
  const [visible, setVisible] = useState(false);
  const [datos, setDatos] = useState<[string, string][]>([]);
  const [log, setLog] = useState<string[]>([]);

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

  // El `setState` va diferido para no dispararlo dentro del cuerpo del efecto
  // (`react-hooks/set-state-in-effect`, §114).
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("diag")) return;
    const t = setTimeout(() => setVisible(true), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) return;

    const medir = () => {
      const nav = document.querySelector<HTMLElement>("[data-barra-nav]");
      const top = document.querySelector<HTMLElement>("[data-topbar]");
      const main = document.querySelector<HTMLElement>("main");
      const vv = window.visualViewport;
      const rn = nav?.getBoundingClientRect();
      const rt = top?.getBoundingClientRect();
      const cs = nav ? getComputedStyle(nav) : null;
      const raiz = document.documentElement;
      setDatos([
        ["standalone", String(window.matchMedia("(display-mode: standalone)").matches)],
        ["innerH / clientH", `${window.innerHeight} / ${raiz.clientHeight}`],
        ["screen.h / availH", `${window.screen.height} / ${window.screen.availHeight}`],
        ["vv.h / vv.top / scale", vv ? `${Math.round(vv.height)} / ${Math.round(vv.offsetTop)} / ${vv.scale}` : "sin visualViewport"],
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
    for (const ev of ["resize", "scroll", "focusin", "focusout", "orientationchange"]) {
      window.addEventListener(ev, medir);
    }
    window.visualViewport?.addEventListener("resize", medir);
    window.visualViewport?.addEventListener("scroll", medir);
    return () => {
      clearInterval(t);
      for (const ev of ["resize", "scroll", "focusin", "focusout", "orientationchange"]) {
        window.removeEventListener(ev, medir);
      }
      window.visualViewport?.removeEventListener("resize", medir);
      window.visualViewport?.removeEventListener("scroll", medir);
    };
  }, [visible]);

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

  return (
    <div className="fixed inset-x-0 top-0 z-100 max-h-[75vh] overflow-auto border-b border-danger bg-background p-2 text-[10px] leading-tight shadow-lg">
      <div className="mb-1 flex items-center gap-2">
        <strong className="text-[11px] text-danger">DIAG BARRAS</strong>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="ml-auto rounded border border-border px-2 py-0.5 text-[10px]"
        >
          cerrar
        </button>
      </div>
      <table className="w-full">
        <tbody>
          {datos.map(([k, v]) => (
            <tr key={k}>
              <td className="w-40 pr-2 text-subtitle">{k}</td>
              <td className="tabular-nums break-all">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
      </div>
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
