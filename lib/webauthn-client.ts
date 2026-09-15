"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

/**
 * Cliente de WebAuthn (login con biometría / passkeys).
 *
 * El navegador nunca manda la huella: pide al sistema operativo que firme un
 * desafío con la clave privada del dispositivo (que no sale de ahí) y envía esa
 * firma al servidor, que la valida con la clave pública guardada.
 */

export interface ResultadoBiometria {
  ok: boolean;
  error?: string;
}

/** Por qué el dispositivo (no) puede usar biometría. */
export type MotivoBiometria =
  | "ok"
  | "sin-ventana" // SSR: todavía no hay `window`
  | "insegura" // HTTP: WebAuthn exige contexto seguro
  | "sin-api" // el navegador no expone WebAuthn
  | "sin-metodo" // existe la API pero no la comprobación
  | "sin-respuesta" // la comprobación no respondió (timeout)
  | "error" // la comprobación tiró una excepción
  | "no-disponible"; // el sistema no reporta autenticador con biometría

export interface EstadoBiometria {
  /** true solo si el sistema confirmó que hay biometría usable. */
  soportado: boolean;
  /**
   * La API existe y el contexto es seguro ⇒ **la ceremonia se puede intentar**.
   *
   * Es lo que gobierna el botón "Activar": `isUserVerifyingPlatformAuthenticator`
   * es solo un PISTA. En iPhone devuelve `false` si el usuario no tiene un gestor
   * de llaves de acceso configurado (llavero de iCloud apagado, o un gestor de
   * terceros) **aunque iOS después ofrezca administrarlas** y la creación
   * termine funcionando. Con `soportado` como candado, esa persona no podía ni
   * intentarlo.
   */
  puedeIntentar: boolean;
  motivo: MotivoBiometria;
  /** Mensaje del error original, si hubo. */
  detalle?: string;
  /**
   * Línea de diagnóstico (para reportar problemas en dispositivos donde la
   * comprobación falla): origen, contexto seguro, presencia de la API, resultado
   * crudo, capacidades del cliente, modo standalone y user agent.
   */
  diagnostico: string;
}

/** El navegador no siempre contesta: si no lo hace en 3s, seguimos. */
const TIMEOUT_MS = 3000;

/** ¿Se puede intentar una ceremonia WebAuthn? (contexto seguro + API presente). */
export function webAuthnUsable(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext === true &&
    "PublicKeyCredential" in window &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.credentials)
  );
}

/**
 * ¿El dispositivo ofrece biometría (huella/Face ID/Windows Hello)?
 *
 * Devuelve el MOTIVO además del resultado: en iPhone/Safari puede fallar por
 * cosas muy distintas (falta HTTPS, WebView, Face ID sin llavero de iCloud…)
 * y con un booleano no hay forma de saber cuál.
 */
export async function estadoBiometria(): Promise<EstadoBiometria> {
  if (typeof window === "undefined") {
    return {
      soportado: false,
      puedeIntentar: false,
      motivo: "sin-ventana",
      diagnostico: "sin window (SSR)",
    };
  }

  const hayApi = "PublicKeyCredential" in window;
  const segmentos: string[] = [
    window.location.origin,
    `seguro:${window.isSecureContext}`,
    `api:${hayApi}`,
  ];

  // Modo app instalada (en iOS, `standalone` es un caso aparte).
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  segmentos.push(`standalone:${standalone ? "sí" : "no"}`);

  if (!hayApi) {
    return {
      soportado: false,
      puedeIntentar: false,
      motivo: window.isSecureContext ? "sin-api" : "insegura",
      diagnostico: [...segmentos, `ua:${navigator.userAgent}`].join(" · "),
    };
  }

  const pkc = PublicKeyCredential as unknown as {
    isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
    getClientCapabilities?: () => Promise<Record<string, boolean>>;
  };

  if (typeof pkc.isUserVerifyingPlatformAuthenticatorAvailable !== "function") {
    return {
      soportado: false,
      puedeIntentar: false,
      motivo: "sin-metodo",
      diagnostico: [...segmentos, `ua:${navigator.userAgent}`].join(" · "),
    };
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const resultado = await Promise.race([
      pkc.isUserVerifyingPlatformAuthenticatorAvailable(),
      new Promise<"timeout">((resolve) => {
        timeout = setTimeout(() => resolve("timeout"), TIMEOUT_MS);
      }),
    ]);

    if (resultado === "timeout") {
      return {
        soportado: false,
        puedeIntentar: true,
        motivo: "sin-respuesta",
        diagnostico: [...segmentos, "uvpa:sin-respuesta", `ua:${navigator.userAgent}`].join(" · "),
      };
    }

    // Dato extra (Safari 17.4+): capacidades declaradas del cliente.
    let caps = "n/d";
    try {
      if (typeof pkc.getClientCapabilities === "function") {
        const c = await pkc.getClientCapabilities();
        caps = `uvpa:${c?.userVerifyingPlatformAuthenticator ?? "?"}`;
      }
    } catch {
      /* opcional */
    }

    return {
      soportado: resultado === true,
      puedeIntentar: true,
      motivo: resultado === true ? "ok" : "no-disponible",
      diagnostico: [
        ...segmentos,
        `uvpa:${resultado}`,
        `caps:${caps}`,
        `ua:${navigator.userAgent}`,
      ].join(" · "),
    };
  } catch (error) {
    const detalle = (error as Error)?.message ?? String(error);
    const nombre = (error as Error)?.name ?? "";
    const seguridad = nombre === "SecurityError";
    return {
      soportado: false,
      puedeIntentar: !seguridad,
      motivo: seguridad ? "insegura" : "error",
      detalle: `${nombre}: ${detalle}`,
      diagnostico: [
        ...segmentos,
        `uvpa:error(${nombre})`,
        `ua:${navigator.userAgent}`,
      ].join(" · "),
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** Nombre sugerido para la passkey según el equipo (se puede renombrar después). */
export function nombreDeDispositivo(): string {
  if (typeof navigator === "undefined") return "Dispositivo";
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "Dispositivo";
}

/** Alta: registra ESTE dispositivo como passkey del usuario logueado. */
export async function activarBiometria(): Promise<ResultadoBiometria> {
  try {
    const resOpts = await fetch("/api/auth/webauthn/register/options", {
      method: "POST",
    });
    if (!resOpts.ok) {
      const data = await resOpts.json().catch(() => ({}));
      return { ok: false, error: data.error ?? "No se pudo iniciar el registro" };
    }
    const optionsJSON = await resOpts.json();

    const response = await startRegistration({ optionsJSON });

    const res = await fetch("/api/auth/webauthn/register/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response, nombre: nombreDeDispositivo() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error ?? "No se pudo verificar el dispositivo" };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
}

/** Login sin escribir nada: el sistema operativo ofrece las passkeys del sitio. */
export async function entrarConBiometria(
  recordar: boolean
): Promise<ResultadoBiometria> {
  try {
    const resOpts = await fetch("/api/auth/webauthn/login/options", {
      method: "POST",
    });
    if (!resOpts.ok) {
      return { ok: false, error: "No se pudo iniciar el acceso con biometría" };
    }
    const optionsJSON = await resOpts.json();

    const response = await startAuthentication({ optionsJSON });

    const res = await fetch("/api/auth/webauthn/login/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response, recordar }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error ?? "No pudimos validar el acceso" };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: mensajeDeError(error) };
  }
}

/**
 * Traduce los errores del navegador a algo entendible. El más común es
 * `NotAllowedError`: el usuario canceló el prompt biométrico o pasó el tiempo
 * (también sale si no hay ninguna passkey para este sitio).
 */
function mensajeDeError(error: unknown): string {
  const name = (error as { name?: string })?.name ?? "";
  if (name === "NotAllowedError") {
    return "Cancelaste la operación, expiró el tiempo o este dispositivo no tiene una passkey guardada.";
  }
  if (name === "InvalidStateError") {
    return "Este dispositivo ya tiene una passkey registrada. Si perdiste el acceso con biometría, revocá esa credencial de la lista y volvé a activarla.";
  }
  if (name === "NotSupportedError") {
    return "Este dispositivo o navegador no soporta passkeys.";
  }
  if (name === "SecurityError") {
    return "No se pudo usar biometría en este contexto (revisá que sea HTTPS).";
  }
  return "No se pudo completar la operación con biometría.";
}
