import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getDb } from "@/backend/src/db";
import { WebauthnCredential } from "@/backend/src/entities/webauthn-credential.entity";
import { getSessionUser } from "@/backend/src/lib/auth";
import {
  getWebAuthnConfig,
  guardarDesafio,
  parseTransports,
} from "@/backend/src/lib/webauthn";

/**
 * Paso 1 del alta de una passkey: devuelve las opciones para
 * `navigator.credentials.create()` y guarda el desafío en una cookie firmada.
 *
 * Requiere sesión (la passkey se asocia al usuario logueado).
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { rpID, rpName } = await getWebAuthnConfig();

  // Credenciales ya registradas: se excluyen para no registrar dos veces el
  // mismo dispositivo (el navegador avisa "ya está registrado").
  const ds = await getDb();
  const existentes = await ds.getRepository(WebauthnCredential).find({
    where: { usuario: { id: user.id }, eliminado: false },
  });

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: user.nombre ?? user.email,
    // Identificador del usuario DENTRO de la credencial (no es PII pública).
    userID: new TextEncoder().encode(String(user.id)),
    attestationType: "none",
    excludeCredentials: existentes.map((c) => ({
      id: c.credentialId,
      transports: parseTransports(c.transports),
    })),
    authenticatorSelection: {
      // Passkey "descubrible": permite entrar sin escribir el email.
      residentKey: "required",
      // Pide biometría/PIN, pero permite equipos sin biometría (caen al PIN).
      userVerification: "preferred",
    },
  });

  await guardarDesafio(options.challenge, user.id);
  return NextResponse.json(options);
}
