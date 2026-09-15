import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getDb } from "@/backend/src/db";
import { WebauthnCredential } from "@/backend/src/entities/webauthn-credential.entity";
import {
  getWebAuthnConfig,
  guardarDesafio,
  leerPistaCredencial,
  parseTransports,
} from "@/backend/src/lib/webauthn";

/**
 * Paso 1 del login con biometría: devuelve las opciones para
 * `navigator.credentials.get()` y guarda el desafío en una cookie firmada.
 *
 * Si el dispositivo ya usó una passkey (cookie "pista") se la ofrece puntualmente
 * en `allowCredentials`: el navegador resuelve el login sin abrir el selector de
 * cuentas. Si no hay pista, `allowCredentials: []` ⇒ **passkey descubrible** (el
 * sistema operativo muestra las passkeys del sitio sin escribir el email). No
 * revela si el usuario existe, así que es seguro que sea público.
 */
export async function POST() {
  const { rpID } = await getWebAuthnConfig();

  const pista = await leerPistaCredencial();
  let allowCredentials: { id: string; transports?: string[] }[] = [];
  if (pista) {
    const ds = await getDb();
    const cred = await ds.getRepository(WebauthnCredential).findOne({
      where: { credentialId: pista, eliminado: false },
    });
    if (cred) {
      allowCredentials = [
        { id: cred.credentialId, transports: parseTransports(cred.transports) },
      ];
    }
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: "preferred",
  });

  await guardarDesafio(options.challenge);
  return NextResponse.json(options);
}
