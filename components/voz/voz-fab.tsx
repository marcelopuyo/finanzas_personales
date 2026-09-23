"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTap } from "@/lib/tap";
import { usePendingNav } from "@/components/ui/nav-progress";
import { VOZ_LANG } from "@/lib/voz/config";
import { dejarTexto } from "@/lib/voz/handoff";
import { INTENCIONES } from "@/lib/voz/intenciones";
import { parsearIntencion } from "@/lib/voz/parse-intencion";
import {
  iniciarDictado,
  soporteVoz,
  type ErrorVoz,
  type EstadoDictado,
  type SesionDictado,
} from "@/lib/voz/speech";

/**
 * **FAB 🎤 global** — fase **G1** del replanteo de la voz (plan §14: R1-R8).
 *
 * Un solo botón que decide **qué quiere hacer** el usuario:
 * - **Intención reconocida** ⇒ navega (sin confirmación previa, R8/§8.3 de plan).
 * - **No la reconoce** ⇒ burbuja con **ejemplos tocables** (R3), sin navegar.
 * - **No hay soporte** (Firefox) ⇒ el botón se ve igual y **avisa al tocarlo** (R5).
 * - **Mientras escucha** ⇒ **solo indicador visual** (pulso), sin texto (R6).
 *
 * ⚠️ **En G1 solo NAVEGA**: el llenado de los campos de la pantalla actual llega
 * en **G3**. El texto sobrante ya se deja en el handoff (`lib/voz/handoff.ts`,
 * D10) para que esa fase lo consuma sin tocar esta pieza.
 *
 * 🔑 **Motores y receta**: `lib/voz/speech.ts` trae los defaults por plataforma
 * (`dictadoRecomendado()`): la receta de iOS (sin `continuous`, con reapertura y
 * preparación de audio) está probada en un iPhone real (bitácora §144) y en
 * Chrome/Edge se usa el modo continuo. Acá no se elige nada: se usa el default.
 *
 * 📍 **Posición** (R4: abajo a la derecha, **apilado** sobre la acción primaria):
 * la maneja `globals.css` con la clase `.fp-voz-fab` + `:has([data-barra-inferior])`
 * — la barra inferior de los CRUD marca ese atributo y el FAB sube solo, sin
 * estado compartido ni JS.
 *
 * Se monta en `AppLayout` (área de usuario) **fuera** de `PullToRefresh`: usa touch
 * events propios y no debe disparar el gesto de "tirar para actualizar".
 */
const MENSAJE_ERROR: Record<ErrorVoz, string> = {
  permiso: "No tengo permiso para usar el micrófono. Habilitalo y probá de nuevo.",
  "sin-habla": "No te escuché. Probá de nuevo hablando un poco más fuerte.",
  "sin-red": "Sin conexión el dictado no funciona: el reconocimiento lo hace el navegador.",
  "no-soportado": "Este navegador no soporta dictado por voz. Probá con Chrome, Edge o Safari.",
  desconocido: "El reconocedor falló. Probá otra vez.",
};

/** Aviso de la burbuja (R8: pegada al FAB). `escuchado` solo cuando no entendió. */
type Aviso = { texto: string; escuchado?: string } | null;

export function VozFab() {
  const { go } = usePendingNav();
  const [estado, setEstado] = useState<EstadoDictado>("listo");
  const [aviso, setAviso] = useState<Aviso>(null);
  const sesion = useRef<SesionDictado | null>(null);

  const escuchando = estado === "iniciando" || estado === "escuchando";

  /** Resuelve el texto reconocido: navega, o explica que no entendió. */
  const interpretar = (texto: string) => {
    const { intencion, resto } = parsearIntencion(texto);
    if (!intencion) {
      setAviso({
        escuchado: texto,
        texto: "No entendí qué querías hacer. Probá con uno de estos ejemplos:",
      });
      return;
    }
    setAviso(null);
    // Las intenciones con campos (hoy solo `cargar-gasto`) dejan el sobrante para
    // la pantalla destino; G3 lo va a leer. Las de navegación no guardan nada.
    if (intencion.llevaTexto && resto) dejarTexto(resto);
    go(intencion.href(), `voz-${intencion.id}`);
  };

  const alTocar = () => {
    // Segundo toque mientras escucha: corta y entrega lo reconocido hasta ahí.
    if (sesion.current) {
      sesion.current.detener();
      return;
    }
    setAviso(null);
    if (!soporteVoz().disponible) {
      setAviso({ texto: MENSAJE_ERROR["no-soportado"] });
      return;
    }
    sesion.current = iniciarDictado({
      lang: VOZ_LANG,
      onEstado: (e) => {
        setEstado(e);
        if (e === "listo") sesion.current = null;
      },
      onError: (e) => setAviso({ texto: MENSAJE_ERROR[e] }),
      onTexto: interpretar,
    });
  };

  const tap = useTap(alTocar);

  // Al abandonar la página hay que soltar el micrófono: una sesión viva deja el
  // micrófono tomado y en iOS la carga siguiente no captura (bitácora §143-§144).
  useEffect(() => {
    const soltar = () => {
      sesion.current?.detener();
      sesion.current = null;
    };
    window.addEventListener("pagehide", soltar);
    return () => {
      window.removeEventListener("pagehide", soltar);
      soltar();
    };
  }, []);

  const ejemplos = INTENCIONES.filter((i) => i.ejemplo);

  return (
    <div className="fp-voz-fab fixed right-4 z-40 flex flex-col items-end gap-2">
      {/* Burbuja pegada al FAB (R8) */}
      {aviso && (
        <div
          role="status"
          className="w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-3 shadow-lg"
        >
          <p className="text-[12.5px] text-card-foreground">{aviso.texto}</p>
          {aviso.escuchado && (
            <p className="mt-1 text-[12.5px] text-subtitle">
              Escuché: «{aviso.escuchado}»
            </p>
          )}

          {ejemplos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ejemplos.map((i) => (
                <EjemploVoz
                  key={i.id}
                  texto={i.ejemplo ?? ""}
                  onElegir={interpretar}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setAviso(null)}
            className="mt-2 text-[11px] text-subtitle underline"
          >
            Cerrar
          </button>
        </div>
      )}

      <button
        type="button"
        aria-label={escuchando ? "Detener el dictado" : "Dictar por voz"}
        title={escuchando ? "Escuchando…" : "Dictar"}
        className={cn(
          "relative flex h-13 w-13 items-center justify-center rounded-full shadow-lg",
          "transition-transform active:scale-95",
          // `touch-none`: el gesto no scrollea ni dispara el pull-to-refresh (el FAB
          // igual queda fuera del <main>, esto es defensivo); `select-none` +
          // highlight transparente evitan el destello/la selección al mantener.
          "touch-none select-none [-webkit-tap-highlight-color:transparent]",
          escuchando ? "bg-danger text-white" : "bg-header text-background"
        )}
        // `useTap`: en iOS el `click` puede no llegar (bitácora §119).
        {...tap}
      >
        {escuchando && (
          <span
            className="fp-voz-pulso absolute inset-0 rounded-full bg-danger"
            aria-hidden="true"
          />
        )}
        <Mic className="relative h-5.5 w-5.5" />
      </button>
    </div>
  );
}

/**
 * Ejemplo tocable de la burbuja: al tocarlo se **ejecuta** esa frase (o sea,
 * navega), no se copia el texto. Va en su propio componente para poder usar
 * `useTap` (los hooks no se pueden llamar dentro de un `map`).
 */
function EjemploVoz({
  texto,
  onElegir,
}: {
  texto: string;
  onElegir: (texto: string) => void;
}) {
  const tap = useTap(() => onElegir(texto));
  return (
    <button
      type="button"
      className="rounded-full border border-border px-2.5 py-1 text-[11.5px] text-header active:bg-muted"
      {...tap}
    >
      «{texto}»
    </button>
  );
}
