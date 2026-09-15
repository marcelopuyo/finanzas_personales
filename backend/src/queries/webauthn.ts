import { getDb } from "../db";
import { WebauthnCredential } from "../entities/webauthn-credential.entity";
import { getSessionUserId } from "../lib/auth";
import { leerPistaCredencial } from "../lib/webauthn";

export interface CredencialWebauthnOut {
  id: number;
  nombre: string | null;
  deviceType: string | null;
  backedUp: boolean;
  creadoEn: string;
  ultimoUsoEn: string | null;
}

/**
 * Credenciales (passkeys) activas del usuario autenticado, para listarlas en
 * Perfil. No expone la clave pública ni el `credentialId` (el cliente no los
 * necesita: el login los resuelve el servidor).
 */
export async function getCredencialesWebauthn(): Promise<
  CredencialWebauthnOut[]
> {
  const userId = await getSessionUserId();
  if (!userId) return [];

  const ds = await getDb();
  const filas = await ds.getRepository(WebauthnCredential).find({
    where: { usuario: { id: userId }, eliminado: false },
    order: { creadoEn: "ASC" },
  });

  return filas.map((c) => ({
    id: c.id,
    nombre: c.nombre ?? null,
    deviceType: c.deviceType ?? null,
    backedUp: c.backedUp,
    creadoEn: new Date(c.creadoEn).toISOString(),
    ultimoUsoEn: c.ultimoUsoEn ? new Date(c.ultimoUsoEn).toISOString() : null,
  }));
}

/**
 * ¿Esta visita viene de un dispositivo que YA tiene biometría activada?
 *
 * Se apoya en la cookie "pista" (httpOnly), que se escribe únicamente al
 * registrar una passkey EN ESTE dispositivo o al entrar con ella. Es a
 * propósito: **el primer inicio de sesión de un dispositivo siempre es con
 * contraseña** (el alta de la passkey requiere estar logueado), así que un
 * equipo nuevo no ve el botón de biometría ni puede intentar un login que no
 * tiene credenciales.
 */
export async function passkeyEnEsteDispositivo(): Promise<boolean> {
  const pista = await leerPistaCredencial();
  if (!pista) return false;

  const ds = await getDb();
  const cred = await ds.getRepository(WebauthnCredential).findOne({
    where: { credentialId: pista, eliminado: false },
    select: { id: true },
  });
  return cred !== null;
}
