import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getDb } from "@/backend/src/db";
import { WebauthnCredential } from "@/backend/src/entities/webauthn-credential.entity";
import { getSessionUserId } from "@/backend/src/lib/auth";
import {
  getWebAuthnConfig,
  guardarDesafio,
  leerPistaCredencial,
  parseTransports,
} from "@/backend/src/lib/webauthn";

/**
 * Paso 1 del DESBLOQUEO de la app (bloqueo al volver del segundo plano, 2026-09-15):
 * devuelve las opciones para `navigator.credentials.get()`.
 *
 * Diferencias con el LOGIN con biometría (a propósito):
 * - Acá **sí hay sesión**: el desafío se ata al usuario (`guardarDesafio(challenge,
 *   userId)`) y `allowCredentials` va con la credencial de ESTE dispositivo (la
 *   pista), sin flujo descubrible.
 * - `userVerification: "required"`: el desbloqueo EXIGE la biometría (o el PIN del
 *   equipo). En el login alcanza con `"preferred"` porque abrir la sesión ya es la
 *   acción que el usuario pidió; acá la gracia es justamente que la pida.
 *
 * No toca la cookie de sesión: desbloquear no vuelve a loguear (ver `verify`).
 */
export async function POST() {
  // Sin sesión no hay nada que desbloquear (el cliente se va a /login).
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "no-sesion" }, { status: 401 });
  }

  const pista = await leerPistaCredencial();
  if (!pista) {
    return NextResponse.json(
      { error: "Este dispositivo no tiene una passkey activada" },
      { status: 400 }
    );
  }

  // La credencial tiene que ser DEL USUARIO logueado y seguir activa.
  const ds = await getDb();
  const cred = await ds.getRepository(WebauthnCredential).findOne({
    where: {
      credentialId: pista,
      usuario: { id: userId },
      eliminado: false,
    },
  });
  if (!cred) {
    return NextResponse.json(
      { error: "Este dispositivo no tiene una passkey activada" },
      { status: 400 }
    );
  }

  const { rpID } = await getWebAuthnConfig();
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: [
      { id: cred.credentialId, transports: parseTransports(cred.transports) },
    ],
    userVerification: "required",
  });

  await guardarDesafio(options.challenge, userId);
  return NextResponse.json(options, {
    headers: { "Cache-Control": "no-store" },
  });
}
