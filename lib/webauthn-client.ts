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

/** ¿El dispositivo ofrece biometría (huella/Face ID/Windows Hello)? */
export async function biometriaDisponible(): Promise<boolean> {
  if (typeof window === "undefined" || !("PublicKeyCredential" in window)) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
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
