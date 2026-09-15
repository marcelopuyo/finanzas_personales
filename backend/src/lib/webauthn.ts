import { cookies, headers } from "next/headers";
import { signShortToken, verifyShortToken } from "./auth";

/**
 * Configuración y helpers de WebAuthn (login con biometría / passkeys).
 *
 * ⚠️ El **RP ID** ata las passkeys a un dominio para siempre: las que se
 * registren en `localhost` solo sirven en local y las de `*.vercel.app` dejan
 * de funcionar si más adelante se usa un dominio propio (hay que re-registrar).
 * Por eso, por defecto, se DERIVA del pedido (funciona en dev, en el dominio de
 * Vercel y en los previews) y se puede FIJAR con variables de entorno
 * `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` si algún día hace falta.
 */

const CHALLENGE_COOKIE = "fp_wa_challenge";
/** El desafío es de un solo uso y de vida corta (el usuario tiene 60s para el prompt). */
const CHALLENGE_MAX_AGE_SECONDS = 5 * 60;

export interface WebAuthnConfig {
  /** Dominio (sin puerto) que se le exige al autenticador. */
  rpID: string;
  /** Nombre visible que muestra el sistema operativo al crear la passkey. */
  rpName: string;
  /** Origen exacto (protocolo + host) que se valida en la verificación. */
  origin: string;
}

/** RP ID / origen esperados, derivados del pedido (o de las env si están). */
export async function getWebAuthnConfig(): Promise<WebAuthnConfig> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost")
    .split(",")[0]
    .trim();
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0].trim();

  return {
    rpID: process.env.WEBAUTHN_RP_ID ?? host.replace(/:\d+$/, ""),
    rpName: "Finanzas Personales",
    origin: process.env.WEBAUTHN_ORIGIN ?? `${proto}://${host}`,
  };
}

/**
 * Guarda el desafío en una cookie httpOnly **firmada** (JWT corto).
 *
 * Se firma a propósito: si el cliente pudiera elegir el desafío, una assertion
 * capturada antes podría reenviarse (replay). Con la firma, el desafío solo
 * puede ser el que emitió el servidor hace menos de 5 minutos.
 */
export async function guardarDesafio(
  challenge: string,
  userId?: number
): Promise<void> {
  const token = await signShortToken(
    { challenge, uid: userId ?? null },
    `${CHALLENGE_MAX_AGE_SECONDS}s`
  );
  const store = await cookies();
  store.set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: CHALLENGE_MAX_AGE_SECONDS,
  });
}

/** Lee el desafío pendiente (o null si no hay / venció / fue manipulado). */
export async function leerDesafio(): Promise<{
  challenge: string;
  userId: number | null;
} | null> {
  const store = await cookies();
  const token = store.get(CHALLENGE_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyShortToken<{
    challenge?: string;
    uid?: number | null;
  }>(token);
  if (!payload?.challenge) return null;

  return { challenge: payload.challenge, userId: payload.uid ?? null };
}

/** Descarta el desafío (después de usarlo: es de un solo uso). */
export async function olvidarDesafio(): Promise<void> {
  const store = await cookies();
  store.delete(CHALLENGE_COOKIE);
}

const HINT_COOKIE = "fp_wa_hint";
const HINT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * "Pista" de credencial: recuerda QUÉ passkey usa este dispositivo.
 *
 * No es un secreto (el id de credencial es público), pero permite mandar
 * `allowCredentials` en el login, que es el camino más compatible: si se manda
 * vacío el navegador tiene que abrir el selector de cuentas (flujo
 * "descubrible") y hay entornos donde eso no está disponible ⇒ el login falla
 * con `NotAllowedError`. Si no hay pista (o la credencial ya no existe) se
 * vuelve al flujo descubrible, que sigue funcionando en Chrome/Safari de
 * celular y escritorio.
 */
export async function guardarPistaCredencial(credentialId: string): Promise<void> {
  const store = await cookies();
  store.set(HINT_COOKIE, credentialId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: HINT_MAX_AGE_SECONDS,
  });
}

/** Credencial que este dispositivo viene usando (o null si no hay pista). */
export async function leerPistaCredencial(): Promise<string | null> {
  const store = await cookies();
  return store.get(HINT_COOKIE)?.value ?? null;
}

/** Olvida la pista (al revocar justamente esa credencial). */
export async function olvidarPistaCredencial(): Promise<void> {
  const store = await cookies();
  store.delete(HINT_COOKIE);
}

/** `transports` guardados como texto ("internal,hybrid") → array. */
export function parseTransports(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
