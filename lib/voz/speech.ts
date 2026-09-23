/**
 * Envoltura de `SpeechRecognition` (Web Speech API) — **sin dependencias**.
 *
 * 🔑 Decisiones clave (D5/D16 del plan):
 * - **Detección con prefijo**: en iOS/Safari la API solo existe como
 *   `webkitSpeechRecognition`. Con `window.SpeechRecognition` a secas el botón
 *   nunca aparecería en el iPhone.
 * - **Defaults = receta probada** (`dictadoRecomendado()`, 2026-09-23): en **iOS**
 *   `continuous = false` + reapertura en `onend` + `preparacionAudio = "ambas"`;
 *   en Chrome/Edge/Android `continuous = true` y `preparacionAudio = "ninguna"`
 *   (ahí el modo continuo **sí** es estable y da mejor experiencia). La receta de
 *   iOS está **validada en un iPhone real**: sin ella la 2ª sesión arranca muda.
 * - **Auto-parada**: se corta tras `SILENCIO_MS` de silencio, o a los
 *   `ESPERA_HABLA_MS` si nunca se escuchó nada, o al tope de `MAX_DICTADO_MS`.
 * - **Sin red no hay dictado**: Chrome transcribe en los servidores de Google y
 *   Safari en los de Apple. El error se informa, nunca queda un spinner eterno.
 * - ⚠️ **Cierre y reinicio pensados para iOS** (fix 2026-09-20): el cierre va con
 *   **`stop()`** y no con `abort()`, el reinicio usa una **instancia nueva** y
 *   solo se reintenta si el corte fue **sin pausa real**. Con `abort()` + reinicio
 *   inmediato, en iOS la sesión siguiente **arrancaba pero no capturaba nada**.
 * - ⚠️ **Sesión de audio de iOS** (investigado el 2026-09-23): que la segunda
 *   sesión arranque **muda** (sin `onresult`, sin `onerror` y sin `onend`) es un
 *   bug de **WebKit**, no de este archivo: la fuente del micrófono del reconocedor
 *   no mantiene activa la *audio session* del sistema.
 *   - `bugs.webkit.org/show_bug.cgi?id=317741` (*Speech recognition microphone
 *     source should make sure to keep its audio session active while capturing*):
 *     **RESOLVED FIXED** por Apple el **2026-06-26** (`315887@main`) ⇒ todavía no
 *     está en el iOS estable.
 *   - `bugs.webkit.org/show_bug.cgi?id=321436` (y `WICG/speech-api#96`): el mismo
 *     síntoma, disparado por reproducir un `<audio>`/`<video>` — en esta app **no
 *     hay ningún medio**, así que el disparador es el propio ciclo de captura.
 *   - Mitigaciones de la comunidad (parciales; ver `preparacionAudio`): abrir y
 *     soltar el micrófono con `getUserMedia` antes de cada `start()`, crear y
 *     reanudar un `AudioContext` dentro del gesto, `continuous = false` con
 *     reapertura en `onend`, no reusar la instancia y cerrar con `stop()`+`abort()`.
 */

import {
  ESPERA_HABLA_MS,
  MAX_DICTADO_MS,
  MAX_REINICIOS,
  REINICIO_MS,
  SILENCIO_MS,
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

/**
 * ¿Es un navegador **WebKit en iOS** (Safari, o cualquier navegador del iPhone,
 * que por dentro es WebKit)? Ahí rigen los parches de `dictadoRecomendado()`.
 *
 * Se detecta por *user agent* porque no hay otra forma: `SpeechRecognition` no
 * expone la plataforma.
 */
export function esWebKitIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPad con iPadOS 13+ se anuncia como "Macintosh" pero con pantalla táctil.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

/**
 * Valores por defecto **recomendados**, por plataforma.
 *
 * En iOS es la **receta probada en un iPhone real (2026-09-23)**: con `continuous`
 * apagado + reapertura en `onend` + preparación `"ambas"` el dictado **funciona en
 * sesiones sucesivas**. Sin esa combinación la 2ª sesión arranca **muda** por el
 * bug de WebKit (ver la cabecera del archivo).
 *
 * En Chrome/Edge/Android el modo continuo **sí** es estable y da mejor experiencia,
 * así que ahí se mantiene encendido y no hace falta preparar el audio.
 */
export function dictadoRecomendado(): {
  continuous: boolean;
  permitirReinicio: boolean;
  preparacionAudio: PreparacionAudio;
} {
  return esWebKitIOS()
    ? { continuous: false, permitirReinicio: true, preparacionAudio: "ambas" }
    : { continuous: true, permitirReinicio: true, preparacionAudio: "ninguna" };
}

/**
 * Cómo se prepara la sesión de audio antes de cada `start()` (parche del bug de
 * WebKit en iOS; ver la cabecera del archivo).
 * - `ninguna`: comportamiento histórico (así se reprodujo el fallo).
 * - `microfono`: `getUserMedia` y soltar las pistas al instante.
 * - `audioContext`: crear/reanudar un `AudioContext` (se mantiene abierto).
 * - `ambas`: las dos cosas.
 */
export type PreparacionAudio = "ninguna" | "microfono" | "audioContext" | "ambas";

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
  /**
   * Se llama cuando la sesión terminó **sin reconocer nada** (equivale a un
   * `onTexto` vacío). Es lo que permite dar feedback en TODOS los caminos: sin
   * esto, una sesión que no reconoce nada termina en silencio (bug reportado
   * 2026-09-23: «digo una frase sin sentido y no pasa nada»).
   */
  onSinTexto?: () => void;
  /** Transcripción en vivo (incluye texto provisorio). */
  onParcial?: (texto: string) => void;
  onEstado?: (estado: EstadoDictado) => void;
  onError?: (error: ErrorVoz, detalle?: string) => void;
  /** Traza de lo que hace el reconocedor (para el laboratorio y para depurar iOS). */
  onEvento?: (evento: string, detalle?: string) => void;
  lang?: string;
  /** Tope de duración del dictado en ms. */
  maxMs?: number;
  /**
   * `SpeechRecognition.continuous` — default: **la receta de la plataforma**
   * (`dictadoRecomendado()`): `false` en iOS (el modo continuo de WebKit es
   * inestable), `true` en Chrome/Edge/Android.
   */
  continuous?: boolean;
  /** `SpeechRecognition.interimResults` (default `true`). */
  interimResults?: boolean;
  /**
   * Reabrir la sesión cuando el navegador la corta sola — default: **la receta de
   * la plataforma** (`dictadoRecomendado()`), hoy **`true`** en las dos.
   *
   * Es la pieza que **reemplaza al modo continuo en iOS**: con `continuous = false`
   * la sesión se corta en cada pausa y hay que rearmarla. Solo se reabre si el
   * corte fue **sin pausa real** y quedan reintentos (`MAX_REINICIOS`).
   */
  permitirReinicio?: boolean;
  /**
   * Preparación de la sesión de audio antes de cada `start()` — default: **la
   * receta de la plataforma** (`dictadoRecomendado()`): `"ambas"` en iOS,
   * `"ninguna"` en el resto. Es el parche del bug de WebKit (ver la cabecera).
   */
  preparacionAudio?: PreparacionAudio;
  /**
   * Cuántos ms se mantiene abierto el micrófono de prueba cuando la preparación
   * lo abre (default `REINICIO_MS`). `0` = se suelta enseguida.
   */
  mantenerPreparacionMs?: number;
  /** Pausa (ms) antes de reabrir una sesión cortada sola (default `REINICIO_MS`). */
  pausaReaperturaMs?: number;
  /**
   * Al cerrar, además de `stop()` llamar `abort()` (default **`false`**). Los
   * reportes discrepan sobre cuál de los dos libera de verdad la sesión de audio
   * en iOS, así que queda como interruptor del laboratorio.
   */
  abortarAlCerrar?: boolean;
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
 * `AudioContext` de preparación, **compartido entre sesiones**: se crea una sola
 * vez y se deja abierto (cerrarlo devuelve la sesión de audio al sistema y el
 * parche pierde sentido).
 */
let ctxAudio: AudioContext | null = null;

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
  // Defaults por plataforma: es la **receta probada en iOS** (2026-09-23).
  const recomendado = dictadoRecomendado();
  const preparacion = o.preparacionAudio ?? recomendado.preparacionAudio;
  const continuo = o.continuous ?? recomendado.continuous;
  const permitirReinicio = o.permitirReinicio ?? recomendado.permitirReinicio;
  const mantenerPrepMs = o.mantenerPreparacionMs ?? REINICIO_MS;
  const pausaReaperturaMs = o.pausaReaperturaMs ?? REINICIO_MS;

  let activo = true;
  let hablo = false;
  let ultimaActividad = Date.now();
  let reiniciar = 0;
  let acumulado = "";
  let parcial = "";
  let ultimoTrozo = "";
  let estado: EstadoDictado = "iniciando";
  let entregado = false;
  let rec: ReconocimientoVoz | null = null;
  let micPrep: MediaStream | null = null;
  let reintento: ReturnType<typeof setTimeout> | null = null;

  const registrar = (evento: string, detalle = "") => o.onEvento?.(evento, detalle);

  const setEstado = (e: EstadoDictado) => {
    if (estado === e) return;
    estado = e;
    o.onEstado?.(e);
  };

  /** Suelta el micrófono de prueba, si quedó abierto. */
  const soltarMicPrep = () => {
    if (!micPrep) return;
    micPrep.getTracks().forEach((t) => t.stop());
    micPrep = null;
    registrar("microfono-soltado");
  };

  /**
   * Prepara la sesión de audio ANTES de `start()` (parche del bug de WebKit en
   * iOS, ver la cabecera).
   *
   * ⚠️ No se puede `await`: `start()` tiene que quedar **dentro del gesto del
   * usuario**, así que la preparación se dispara y se sigue de largo. Todo queda
   * en la traza para poder comparar combinaciones en el laboratorio.
   */
  const prepararAudio = () => {
    if (preparacion === "ninguna") return;

    if (preparacion === "audioContext" || preparacion === "ambas") {
      try {
        if (!ctxAudio || ctxAudio.state === "closed") {
          ctxAudio = new AudioContext();
        }
        // iOS deja el contexto `suspended` hasta que un gesto lo reanuda.
        void ctxAudio.resume().then(
          () => registrar("audio-context", ctxAudio?.state ?? ""),
          (e) => registrar("audio-context-error", String(e?.name ?? e))
        );
      } catch (e) {
        registrar("audio-context-error", String((e as Error)?.message ?? e));
      }
    }

    if (preparacion === "microfono" || preparacion === "ambas") {
      if (!navigator.mediaDevices?.getUserMedia) {
        registrar("microfono-error", "getUserMedia no disponible");
        return;
      }
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((s) => {
          soltarMicPrep();
          micPrep = s;
          registrar("microfono-preparado", `${s.getTracks().length} pista(s)`);
          if (mantenerPrepMs <= 0) soltarMicPrep();
          else setTimeout(soltarMicPrep, mantenerPrepMs);
        })
        .catch((e) => registrar("microfono-error", String(e?.name ?? e)));
    }
  };

  /**
   * Suelta los handlers de una instancia terminada: si no, la instancia (y su
   * sesión de audio en iOS) sigue viva hasta que la recoja el GC.
   */
  const limpiar = (r: ReconocimientoVoz) => {
    r.onstart = null;
    r.onend = null;
    r.onresult = null;
    r.onerror = null;
    r.onsoundstart = null;
    r.onspeechstart = null;
    if (rec === r) rec = null;
  };

  /** Entrega lo reconocido (una sola vez). */
  const entregar = () => {
    if (entregado) return;
    entregado = true;
    const texto = acumulado.trim();
    if (texto) o.onTexto(texto);
    // Sin texto también se avisa: el consumidor decide qué mostrar.
    else o.onSinTexto?.();
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
      if (o.abortarAlCerrar) {
        // Los reportes discrepan sobre cuál de los dos libera la sesión de audio
        // en iOS: `stop()` deja entrar el último resultado y `abort()` fuerza el
        // teardown. Se hace uno y después el otro (interruptor del laboratorio).
        const r = rec;
        setTimeout(() => {
          try {
            r?.abort();
            registrar("abort");
          } catch {
            // Ya estaba cerrado.
          }
        }, 0);
      }
    } catch {
      // Ya estaba cerrado.
    }
    soltarMicPrep();
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
    // Solo se asigna si viene: en iOS un `lang` no soportado por el dictado del
    // sistema puede hacer que la sesión arranque y no devuelva NADA.
    if (o.lang) r.lang = o.lang;
    r.continuous = continuo;
    r.interimResults = o.interimResults ?? true;
    r.maxAlternatives = 1;

    r.onstart = () => {
      registrar("start", `lang=${r.lang || "(auto)"} cont=${r.continuous}`);
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
      const trozo = final.trim();
      if (trozo) {
        // iOS puede reemitir el MISMO resultado final al reabrir la sesión: sin
        // este guard la transcripción queda repetida 2 o 3 veces.
        if (trozo !== ultimoTrozo) {
          acumulado = `${acumulado} ${trozo}`.trim();
          ultimoTrozo = trozo;
        }
        ultimaActividad = Date.now();
        registrar("texto", trozo);
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
        limpiar(r);
        return;
      }
      // La sesión terminó sola. Se reabre SOLO si está permitido, si el corte
      // fue sin pausa real y quedan reintentos: el ciclo cortar/reabrir es lo
      // que deja el micrófono tomado en iOS.
      const quieto = Date.now() - ultimaActividad;
      const puedeReabrir =
        permitirReinicio &&
        quieto < SILENCIO_MS &&
        reiniciar < MAX_REINICIOS &&
        Date.now() - inicio < maxMs;
      if (!puedeReabrir) {
        limpiar(r);
        cerrar();
        return;
      }
      reiniciar++;
      limpiar(r);
      registrar("reinicio", String(reiniciar));
      reintento = setTimeout(() => {
        if (!activo) return;
        const r = crear();
        prepararAudio();
        try {
          r.start();
        } catch {
          cerrar("desconocido", "no se pudo reiniciar");
        }
      }, pausaReaperturaMs);
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
  prepararAudio();
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
