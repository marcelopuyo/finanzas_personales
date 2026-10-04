"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ZOOM_ACTIVO,
  acotarZoom,
  fijarZoom,
  hidratarZoom,
  suscribirZoom,
} from "@/lib/zoom-contenido";

/**
 * **Capa de contenido con zoom propio** (2026-10-04).
 *
 * El zoom nativo del navegador (pinch) escala **todo** el visual viewport —barras
 * incluidas— y no hay CSS ni HTML que exceptúe un elemento: es una propiedad del
 * viewport, no de la página. Para que las barras **no cambien de tamaño ni de
 * posición**, el zoom se hace acá adentro con la propiedad `zoom` de CSS aplicada
 * **solo a esta capa**; la barra superior, la inferior y los FAB quedan afuera.
 *
 * 🔑 Se usa `zoom` (y no `transform: scale()`) porque **reflota el layout**: el
 * contenido se reacomoda al ancho virtual más chico y el scroll sigue funcionando
 * (con `transform` el área scrolleable no cambia y no se llega al contenido
 * escalado).
 *
 * Gestos: **pinch** de 2 dedos (mobile) y **Ctrl/⌘ + rueda** (trackpad/desktop).
 * Los botones `−`/`+`/`⟲` viven en el popup **Más** de la barra inferior.
 *
 * ⚠️ Se desactiva entero con `ZOOM_ACTIVO = false` (`lib/zoom-contenido.ts`): sin
 * feature la capa no se monta, no se bloquea el pinch nativo y el control
 * desaparece. Ver «cómo deshacerlo» en `DeepSeek/bitacora.md` §218.
 */
export function ZoomContenido({ children }: { children: ReactNode }) {
  const [zoom, setZoom] = useState(1);
  const capaRef = useRef<HTMLDivElement | null>(null);
  /** Zoom vigente para los listeners (no dependen del render). */
  const zoomRef = useRef(1);

  // Estado publicado: se suscribe **antes** de hidratar, así la hidratación avisa
  // al suscriptor y no hace falta un `setState` directo en el efecto.
  useEffect(() => {
    if (!ZOOM_ACTIVO) return;
    const desuscribir = suscribirZoom(setZoom);
    hidratarZoom();
    return desuscribir;
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Gestos. Van en un solo efecto y **sin** dependencias: los handlers leen el
  // zoom del ref, así no se re-registran en cada cambio.
  useEffect(() => {
    if (!ZOOM_ACTIVO) return;
    const capa = capaRef.current;
    if (!capa) return;

    // Marca para el CSS (`globals.css`): mientras está activo se bloquea el pinch
    // nativo. Si no, el zoom del navegador y el nuestro se sumarían.
    document.documentElement.dataset.zoom = "on";

    const distancia = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    /** Zoom previo y separación inicial del pellizco en curso. */
    let separacion0 = 0;
    let zoom0 = 1;

    /** Aplica **sin** pasar por el estado: el gesto llega muchas veces por segundo. */
    const enVivo = (k: number) => {
      const nuevo = acotarZoom(k);
      zoomRef.current = nuevo;
      capa.style.zoom = String(nuevo);
    };

    const alIniciarToque = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      // ⚠️ iOS puede ignorar `touch-action` y pellizcar igual: si el navegador ya
      // está zoomeando, no se suma (las barras las ancla `AnclajeBarras`).
      if ((window.visualViewport?.scale ?? 1) !== 1) {
        separacion0 = 0;
        return;
      }
      separacion0 = distancia(e.touches);
      zoom0 = zoomRef.current;
    };

    const alMoverToque = (e: TouchEvent) => {
      if (separacion0 === 0 || e.touches.length !== 2) return;
      const d = distancia(e.touches);
      if (d === 0) return;
      enVivo(zoom0 * (d / separacion0));
    };

    /** Al soltar: se confirma en el store (una sola escritura, una sola persistencia). */
    const alTerminarToque = (e: TouchEvent) => {
      if (separacion0 === 0) return;
      // Se espera a que quede **un** dedo (o ninguno) para dar el gesto por cerrado.
      if (e.touches.length >= 2) return;
      separacion0 = 0;
      fijarZoom(zoomRef.current);
    };

    /** Ctrl/⌘ + rueda = pellizco del trackpad (y evita el zoom del navegador). */
    const alRodar = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      fijarZoom(zoomRef.current - e.deltaY * 0.0025);
    };

    capa.addEventListener("touchstart", alIniciarToque, { passive: true });
    capa.addEventListener("touchmove", alMoverToque, { passive: true });
    capa.addEventListener("touchend", alTerminarToque, { passive: true });
    capa.addEventListener("touchcancel", alTerminarToque, { passive: true });
    capa.addEventListener("wheel", alRodar, { passive: false });

    return () => {
      capa.removeEventListener("touchstart", alIniciarToque);
      capa.removeEventListener("touchmove", alMoverToque);
      capa.removeEventListener("touchend", alTerminarToque);
      capa.removeEventListener("touchcancel", alTerminarToque);
      capa.removeEventListener("wheel", alRodar);
      delete document.documentElement.dataset.zoom;
    };
  }, []);

  if (!ZOOM_ACTIVO) return <>{children}</>;

  return (
    <div
      ref={capaRef}
      data-zoom-capa=""
      // `--fp-zoom` es para lo que tiene que **no** escalar aunque viva adentro:
      // el caso es la banda de Inicio, que compensa el alto de la barra superior
      // (`--app-top`, en px de dispositivo) con `calc(var(--app-top) / var(--fp-zoom))`.
      style={{ zoom, "--fp-zoom": String(zoom) } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
