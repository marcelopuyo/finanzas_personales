"use client";

import { useEffect, useState } from "react";
import { ZoomIn } from "lucide-react";
import {
  ZOOM_ACTIVO,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_PASO,
  etiquetaZoom,
  fijarZoom,
  hidratarZoom,
  suscribirZoom,
} from "@/lib/zoom-contenido";

/**
 * Ajuste del **zoom del contenido** (Perfil) — 2026-10-05.
 *
 * Antes vivía en el popup de **«Más»** de la barra inferior; el usuario pidió que
 * sea un apartado del **Perfil** (pedido del 2026-10-05).
 *
 * 🔑 Es una preferencia **del dispositivo**, no de la cuenta: se guarda en el
 * `localStorage` de este equipo (`lib/zoom-contenido.ts`, clave `fp_zoom_contenido`)
 * y **sin nada guardado el zoom es 100 %**. Por eso la nota al pie.
 *
 * La capa que aplica el zoom (`components/layout/zoom-contenido.tsx`) ya hidrata el
 * valor guardado, así que acá el control se **suscribe** al store: el número sigue en
 * vivo también cuando el zoom cambia con el pellizco o con Ctrl + rueda.
 */
export function ZoomSection() {
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    if (!ZOOM_ACTIVO) return;
    const desuscribir = suscribirZoom(setZoom);
    hidratarZoom();
    return desuscribir;
  }, []);

  if (!ZOOM_ACTIVO) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <ZoomIn className="h-4 w-4 text-subtitle" />
        <h2 className="text-[14px] font-medium text-header">Zoom del contenido</h2>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <BotonZoom
          etiqueta="Alejar"
          onClick={() => fijarZoom(zoom - ZOOM_PASO)}
          disabled={zoom <= ZOOM_MIN}
        >
          −
        </BotonZoom>
        <span className="min-w-14 text-center text-[15px] tabular-nums text-header">
          {etiquetaZoom(zoom)}
        </span>
        <BotonZoom
          etiqueta="Acercar"
          onClick={() => fijarZoom(zoom + ZOOM_PASO)}
          disabled={zoom >= ZOOM_MAX}
        >
          +
        </BotonZoom>
        {zoom !== 1 && (
          <button
            type="button"
            aria-label="Restablecer al 100 %"
            title="Restablecer al 100 %"
            onClick={() => fijarZoom(1)}
            className="ml-auto rounded-lg border border-border px-3 py-2 text-[12.5px] text-subtitle transition-colors hover:bg-muted"
          >
            100 %
          </button>
        )}
      </div>
      <p className="mt-2 text-[11.5px] text-subtitle">Solo en este equipo.</p>
    </section>
  );
}

/** Botón redondo `−`/`+` del control de zoom. */
function BotonZoom({
  etiqueta,
  onClick,
  disabled,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-[15px] text-card-foreground transition-colors hover:bg-muted disabled:opacity-40"
    >
      {children}
    </button>
  );
}
