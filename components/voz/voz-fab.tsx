"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
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

/** La sesión terminó y no se reconoció nada (feedback garantizado, 2026-09-23). */
const SIN_TEXTO: Aviso = {
  texto: "No te escuché. Probá de nuevo hablando un poco más fuerte.",
};

export function VozFab() {
  const { go } = usePendingNav();
  const ruta = usePathname();
  const [estado, setEstado] = useState<EstadoDictado>("listo");
  const [aviso, setAviso] = useState<Aviso>(null);
  /**
   * `true` mientras hay una **acción primaria a la vista** (el pie de un
   * formulario dentro de la franja del FAB): el FAB se corre para no taparla.
   */
  const [ceder, setCeder] = useState(false);
  const sesion = useRef<SesionDictado | null>(null);
  /** El motor ya avisó un error más específico: no lo pisa el "no te escuché". */
  const huboError = useRef(false);

  // Al cambiar de ruta el FAB vuelve a mostrarse YA (ajuste DURANTE el render,
  // sin `setState` en un efecto): la página nueva no tiene por qué heredar el
  // "hacerse a un lado" de la anterior.
  const [rutaDelCeder, setRutaDelCeder] = useState(ruta);
  if (rutaDelCeder !== ruta) {
    setRutaDelCeder(ruta);
    setCeder(false);
  }

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

  /** Arranca una sesión de dictado nueva. */
  const iniciar = () => {
    huboError.current = false;
    sesion.current = iniciarDictado({
      lang: VOZ_LANG,
      onEstado: (e) => {
        setEstado(e);
        if (e === "listo") sesion.current = null;
      },
      onError: (e) => {
        huboError.current = true;
        setAviso({ texto: MENSAJE_ERROR[e] });
      },
      // Texto reconocido: se resuelve (navega o burbuja con lo escuchado).
      onTexto: interpretar,
      // La sesión terminó sin reconocer nada: sin este aviso el usuario no veía
      // NADA (ni burbuja ni error) y parecía que el FAB no hacía nada.
      onSinTexto: () => {
        if (huboError.current) return;
        setAviso(SIN_TEXTO);
      },
    });
  };

  /**
   * Un solo toque hace todo: arranca, y si ya estaba escuchando **corta**.
   *
   * ⚠️ Acá **no** se toca el micrófono antes de arrancar (`getUserMedia`,
   * `AudioContext`…): se probó el 2026-09-23 y en iOS deja la sesión **peor**
   * (pasó a no captar en ninguna pulsación; ver bitácora §151-§152). El motor ya
   * hace su propia preparación dentro del gesto, sin `await`.
   *
   * ℹ️ **Consecuencia aceptada**: en Safari/iOS el **primer** dictado después de
   * cargar la página puede quedar mudo (bug de la *audio session* de WebKit,
   * §143); a partir del segundo funciona. Se decidió **no** seguir peleando con
   * eso: es tolerable.
   */
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
    iniciar();
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

  /**
   * **El FAB se hace a un lado cuando puede tapar la acción primaria.**
   *
   * El `rootMargin` inferior recorta el viewport en la franja del FAB (7rem),
   * así que un pie marcado con `data-pie-accion` (el de los wizards y el de los
   * `CrudForm`) "interseca" exactamente mientras estaría debajo del FAB ―sea
   * scrolleando o al llegar al final―. Reemplaza la reserva de espacio, que no
   * alcanzaba cuando el pie pasa por la franja a mitad del scroll.
   */
  useEffect(() => {
    let io: IntersectionObserver | null = null;
    const conectar = () => {
      io?.disconnect();
      const pies = document.querySelectorAll("[data-pie-accion]");
      if (!pies.length) return;
      io = new IntersectionObserver(
        (entradas) => setCeder(entradas.some((e) => e.isIntersecting)),
        { rootMargin: "0px 0px -112px 0px" }
      );
      pies.forEach((p) => io?.observe(p));
    };
    conectar();
    // Los pies pueden montarse después del cambio de ruta (pasos del wizard).
    const t = setTimeout(conectar, 700);
    return () => {
      clearTimeout(t);
      io?.disconnect();
    };
  }, [ruta]);

  const ejemplos = INTENCIONES.filter((i) => i.ejemplo);

  return (
    <div
      className={cn(
        "fp-voz-fab fixed right-4 z-40 flex flex-col items-end gap-2",
        "transition-opacity duration-200",
        // Se corre mientras hay una acción primaria debajo (ver el observer).
        ceder && "pointer-events-none opacity-0"
      )}
      aria-hidden={ceder || undefined}
    >
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
