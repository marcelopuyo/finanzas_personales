/**
 * Envoltura de `SpeechRecognition` (Web Speech API) — **sin dependencias**.
 *
 * 🔑 Decisiones clave (D5/D16 del plan):
 * - **Detección con prefijo**: en iOS/Safari la API solo existe como
 *   `webkitSpeechRecognition`. Con `window.SpeechRecognition` a secas el botón
 *   nunca aparecería en el iPhone.
 * - **`continuous = true` + bucle de reinicio**: se pide modo continuo (Safari lo
 *   soporta desde iOS 17) **y** se reinicia la sesión en `onend` mientras el
 *   usuario no haya terminado. Así el mismo código sirve en Chrome, en iOS 14-16
 *   (donde cada sesión se corta sola) y en iOS 17+.
 * - **Auto-parada**: se corta tras `SILENCIO_MS` de silencio, o a los
 *   `ESPERA_HABLA_MS` si nunca se escuchó nada, o al tope de `MAX_DICTADO_MS`.
 * - **Sin red no hay dictado**: Chrome transcribe en los servidores de Google y
 *   Safari en los de Apple. El error se informa, nunca queda un spinner eterno.
 */

import {
  ESPERA_HABLA_MS,
  MAX_DICTADO_MS,
  MAX_REINICIOS,
  SILENCIO_MS,
  VOZ_LANG,
} from "./config";

/**
 * Tipos mínimos propios: `SpeechRecognition` **no** está en `lib.dom.d.ts` y no
 * queremos sumar un `@types` (regla: no instalar dependencias sin consultar).
 */
interface AlternativaVoz {
  transcript: string;
  confidence: number;
}
interface ResultadoVoz {
  isFinal: boolean;
  length: number;
  [i: number]: AlternativaVoz;
}
interface ListaResultadosVoz {
  length: number;
  [i: number]: ResultadoVoz;
}
interface EventoResultadoVoz {
  resultIndex: number;
  results: ListaResultadosVoz;
}
interface EventoErrorVoz {
  error: string;
  message?: string;
}
interface ReconocimientoVoz {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((e: EventoResultadoVoz) => void) | null;
  onerror: ((e: EventoErrorVoz) => void) | null;
  onsoundstart: (() => void) | null;
  onspeechstart: (() => void) | null;
}
type ConstructorVoz = new () => ReconocimientoVoz;

interface VentanaVoz {
  SpeechRecognition?: ConstructorVoz;
  webkitSpeechRecognition?: ConstructorVoz;
}

function constructorVoz(): ConstructorVoz | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as VentanaVoz;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Qué tan disponible está la API en este navegador. */
export function soporteVoz(): {
  disponible: boolean;
  /** Constructor sin prefijo (Chrome/Edge). */
  sinPrefijo: boolean;
  /** Prefijado con `webkit` (Safari, incluido iOS). */
  conPrefijo: boolean;
} {
  if (typeof window === "undefined") {
    return { disponible: false, sinPrefijo: false, conPrefijo: false };
  }
  const w = window as unknown as VentanaVoz;
  return {
    disponible: Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition),
    sinPrefijo: Boolean(w.SpeechRecognition),
    conPrefijo: Boolean(w.webkitSpeechRecognition),
  };
}

export type EstadoDictado = "iniciando" | "escuchando" | "listo";

export type ErrorVoz =
  | "permiso"
  | "sin-habla"
  | "sin-red"
  | "no-soportado"
  | "desconocido";

export interface OpcionesDictado {
  /** Se llama **una vez** al terminar, con todo lo reconocido. */
  onTexto: (texto: string) => void;
  /** Transcripción en vivo (incluye texto provisorio). */
  onParcial?: (texto: string) => void;
  onEstado?: (estado: EstadoDictado) => void;
  onError?: (error: ErrorVoz, detalle?: string) => void;
  lang?: string;
  /** Tope de duración del dictado en ms. */
  maxMs?: number;
}

export interface SesionDictado {
  /** Corta el dictado y entrega lo reconocido hasta ahí. */
  detener: () => void;
  estado: () => EstadoDictado;
  /** Sesiones abiertas (>1 = hubo que reiniciar: iOS sin `continuous`). */
  reinicios: () => number;
  /** Milisegundos desde que empezó. */
  transcurrido: () => number;
}

/**
 * Arranca un dictado. Devuelve `null` si el navegador no soporta la API
 * (Firefox) — en ese caso ya llamó a `onError("no-soportado")`.
 *
 * ⚠️ Debe llamarse desde un gesto del usuario (tap): los navegadores exigen
 * interacción para pedir el micrófono.
 */
export function iniciarDictado(o: OpcionesDictado): SesionDictado | null {
  const Ctor = constructorVoz();
  if (!Ctor) {
    o.onError?.("no-soportado");
    return null;
  }

  const maxMs = o.maxMs ?? MAX_DICTADO_MS;
  const inicio = Date.now();

  let activo = true;
  let hablo = false;
  let ultimaActividad = Date.now();
  let reiniciar = 0;
  let acumulado = "";
  let parcial = "";
  let estado: EstadoDictado = "iniciando";
  let entregado = false;

  const rec = new Ctor();
  rec.lang = o.lang ?? VOZ_LANG;
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  const setEstado = (e: EstadoDictado) => {
    if (estado === e) return;
    estado = e;
    o.onEstado?.(e);
  };

  const finalizar = (error?: ErrorVoz, detalle?: string) => {
    if (!activo) return;
    activo = false;
    clearInterval(vigia);
    try {
      rec.abort();
    } catch {
      // Ya estaba cortado.
    }
    setEstado("listo");
    if (error) o.onError?.(error, detalle);
    if (!entregado) {
      entregado = true;
      const texto = acumulado.trim();
      if (texto) o.onTexto(texto);
    }
  };

  rec.onstart = () => setEstado("escuchando");

  rec.onresult = (e) => {
    let final = "";
    let interino = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      const txt = r?.[0]?.transcript ?? "";
      if (r.isFinal) final += txt;
      else interino += txt;
    }
    if (final.trim()) {
      acumulado = `${acumulado} ${final.trim()}`.trim();
      ultimaActividad = Date.now();
    }
    if (interino.trim()) {
      hablo = true;
      ultimaActividad = Date.now();
    }
    parcial = interino.trim();
    o.onParcial?.(`${acumulado} ${parcial}`.trim());
  };

  const marcarHabla = () => {
    hablo = true;
    ultimaActividad = Date.now();
  };
  rec.onsoundstart = marcarHabla;
  rec.onspeechstart = marcarHabla;

  rec.onerror = (e) => {
    switch (e.error) {
      case "aborted":
        return; // Lo pedimos nosotros.
      case "no-speech":
        // En iOS es lo normal al dejar de hablar: si ya hay texto, se entrega.
        if (acumulado.trim()) finalizar();
        else finalizar("sin-habla", e.error);
        return;
      case "not-allowed":
      case "service-not-allowed":
      case "audio-capture":
        finalizar("permiso", e.error);
        return;
      case "network":
        finalizar("sin-red", e.error);
        return;
      default:
        finalizar("desconocido", e.error);
    }
  };

  rec.onend = () => {
    if (!activo) return;
    if (Date.now() - inicio >= maxMs) {
      finalizar();
      return;
    }
    // iOS corta la sesión sola: se reabre mientras el usuario no haya terminado.
    if (reiniciar >= MAX_REINICIOS) {
      finalizar("desconocido", "demasiados reinicios");
      return;
    }
    reiniciar++;
    try {
      rec.start();
    } catch {
      // `start()` tira si ya está corriendo: se deja morir la sesión.
      finalizar();
    }
  };

  /** Vigilante: silencio, falta de habla y tope de duración. */
  const vigia = setInterval(() => {
    if (!activo) return;
    const ahora = Date.now();
    if (ahora - inicio >= maxMs) {
      finalizar();
      return;
    }
    if (hablo && ahora - ultimaActividad >= SILENCIO_MS) {
      finalizar();
      return;
    }
    if (!hablo && ahora - inicio >= ESPERA_HABLA_MS) {
      finalizar("sin-habla");
    }
  }, 200);

  try {
    rec.start();
  } catch {
    finalizar("desconocido", "no se pudo iniciar");
    return null;
  }

  return {
    detener: () => finalizar(),
    estado: () => estado,
    reinicios: () => reiniciar,
    transcurrido: () => Date.now() - inicio,
  };
}
