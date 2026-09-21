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
 * - ⚠️ **Cierre y reinicio pensados para iOS** (fix 2026-09-20): el cierre va con
 *   **`stop()`** y no con `abort()`, el reinicio usa una **instancia nueva** y
 *   solo se reintenta si el corte fue **sin pausa real**. Con `abort()` + reinicio
 *   inmediato, en iOS la sesión siguiente **arrancaba pero no capturaba nada**.
 */

import {
  ESPERA_HABLA_MS,
  MAX_DICTADO_MS,
  MAX_REINICIOS,
  REINICIO_MS,
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
  /** Traza de lo que hace el reconocedor (para el laboratorio y para depurar iOS). */
  onEvento?: (evento: string, detalle?: string) => void;
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
  let rec: ReconocimientoVoz | null = null;
  let reintento: ReturnType<typeof setTimeout> | null = null;

  const registrar = (evento: string, detalle = "") => o.onEvento?.(evento, detalle);

  const setEstado = (e: EstadoDictado) => {
    if (estado === e) return;
    estado = e;
    o.onEstado?.(e);
  };

  /** Entrega lo reconocido (una sola vez). */
  const entregar = () => {
    if (entregado) return;
    entregado = true;
    const texto = acumulado.trim();
    if (texto) o.onTexto(texto);
  };

  /**
   * Cierra la sesión.
   *
   * ⚠️ **Siempre con `stop()`, nunca con `abort()`** (fix 2026-09-20): en iOS
   * `abort()` deja el micrófono tomado por un «reconocedor zombie» y la sesión
   * siguiente **arranca pero no captura nada**. `stop()` cierra ordenadamente,
   * deja entrar el último resultado y suelta el audio.
   */
  const cerrar = (error?: ErrorVoz, detalle?: string) => {
    if (!activo) return;
    activo = false;
    clearInterval(vigia);
    if (reintento) clearTimeout(reintento);
    setEstado("listo");
    if (error) o.onError?.(error, detalle);
    registrar("cerrar", detalle ?? "");
    try {
      rec?.stop();
    } catch {
      // Ya estaba cerrado.
    }
    // Se entrega al llegar `onend` (así entra el último resultado); si el
    // navegador no lo emite, el respaldo entrega igual.
    setTimeout(entregar, 400);
  };

  /**
   * Crea una instancia NUEVA del reconocedor con sus handlers.
   * En iOS reusar la misma instancia hace que la segunda sesión no capture.
   */
  const crear = (): ReconocimientoVoz => {
    const r = new Ctor();
    r.lang = o.lang ?? VOZ_LANG;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onstart = () => {
      registrar("start");
      setEstado("escuchando");
    };

    r.onresult = (e) => {
      let final = "";
      let interino = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt = res?.[0]?.transcript ?? "";
        if (res.isFinal) final += txt;
        else interino += txt;
      }
      if (final.trim()) {
        acumulado = `${acumulado} ${final.trim()}`.trim();
        ultimaActividad = Date.now();
        registrar("texto", final.trim());
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
      registrar("habla");
    };
    r.onsoundstart = marcarHabla;
    r.onspeechstart = marcarHabla;

    r.onerror = (e) => {
      registrar("error", e.error);
      switch (e.error) {
        case "aborted":
          return; // Lo pedimos nosotros.
        case "no-speech":
          // En iOS es lo normal al dejar de hablar: si ya hay texto, se entrega.
          if (acumulado.trim()) cerrar();
          else cerrar("sin-habla", e.error);
          return;
        case "not-allowed":
        case "service-not-allowed":
        case "audio-capture":
          cerrar("permiso", e.error);
          return;
        case "network":
          cerrar("sin-red", e.error);
          return;
        default:
          cerrar("desconocido", e.error);
      }
    };

    r.onend = () => {
      registrar("end", `reiniciar=${reiniciar}`);
      if (!activo) {
        // Es el `end` del cierre ordenado que pedimos nosotros.
        entregar();
        return;
      }
      // La sesión terminó sola. Se reabre SOLO si puede que el usuario siga
      // hablando (corte sin pausa real): cada reinicio implica un stop/start y
      // el churn es justamente lo que rompe el audio en iOS.
      const quieto = Date.now() - ultimaActividad;
      if (acumulado.trim() && quieto >= SILENCIO_MS) {
        cerrar();
        return;
      }
      if (reiniciar >= MAX_REINICIOS || Date.now() - inicio >= maxMs) {
        cerrar();
        return;
      }
      reiniciar++;
      registrar("reinicio", String(reiniciar));
      reintento = setTimeout(() => {
        if (!activo) return;
        const r = crear();
        try {
          r.start();
        } catch {
          cerrar("desconocido", "no se pudo reiniciar");
        }
      }, REINICIO_MS);
    };

    rec = r;
    return r;
  };

  /** Vigilante: silencio, falta de habla y tope de duración. */
  const vigia = setInterval(() => {
    if (!activo) return;
    const ahora = Date.now();
    if (ahora - inicio >= maxMs) {
      cerrar();
      return;
    }
    if (hablo && ahora - ultimaActividad >= SILENCIO_MS) {
      cerrar();
      return;
    }
    if (!hablo && ahora - inicio >= ESPERA_HABLA_MS) {
      cerrar("sin-habla");
    }
  }, 200);

  const primera = crear();
  try {
    primera.start();
  } catch {
    cerrar("desconocido", "no se pudo iniciar");
    return null;
  }

  return {
    detener: () => cerrar(),
    estado: () => estado,
    reinicios: () => reiniciar,
    transcurrido: () => Date.now() - inicio,
  };
}
