import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getDb } from "@/backend/src/db";
import { WebauthnCredential } from "@/backend/src/entities/webauthn-credential.entity";
import { getSessionUserId } from "@/backend/src/lib/auth";
import {
  getWebAuthnConfig,
  leerDesafio,
  olvidarDesafio,
  parseTransports,
} from "@/backend/src/lib/webauthn";

/**
 * Paso 2 del DESBLOQUEO: verifica la FIRMA del dispositivo contra la clave
 * pública guardada.
 *
 * ⚠️ NO emite sesión (a diferencia del login): la cookie `auth_token` no se
 * toca, porque desbloquear no es volver a entrar. Si acá se llamara a
 * `setAuthCookie` se reescribiría el tipo de sesión (una "mantener la sesión"
 * podría quedar convertida en temporal y el `SessionGuard` la cerraría después).
 * El desbloqueo es puerta de la UI; la barrera real de los datos sigue siendo la
 * sesión.
 *
 * `requireUserVerification: true` es obligatorio: si el autenticador firma sin
 * pedir biometría/PIN, el desbloqueo no vale.
 */
export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "no-sesion" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    response?: { id?: string };
  } | null;
  const credentialId = body?.response?.id;
  if (!body?.response || !credentialId) {
    return NextResponse.json({ error: "Respuesta inválida" }, { status: 400 });
  }

  // El desafío debe existir Y ser de este usuario (no de otro login/desbloqueo).
  const desafio = await leerDesafio();
  if (!desafio || desafio.userId !== userId) {
    return NextResponse.json(
      { error: "El desafío venció. Probá de nuevo." },
      { status: 400 }
    );
  }

  const ds = await getDb();
  const repo = ds.getRepository(WebauthnCredential);
  const cred = await repo.findOne({
    where: {
      credentialId,
      usuario: { id: userId },
      eliminado: false,
    },
  });
  if (!cred) {
    return NextResponse.json(
      { error: "No pudimos validar el desbloqueo" },
      { status: 400 }
    );
  }

  const { rpID, origin } = await getWebAuthnConfig();

  try {
    const verificacion = await verifyAuthenticationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: body.response as any,
      expectedChallenge: desafio.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: cred.credentialId,
        publicKey: Buffer.from(cred.publicKey, "base64url"),
        counter: cred.counter,
        transports: parseTransports(cred.transports),
      },
    });

    if (!verificacion.verified) {
      return NextResponse.json(
        { error: "No pudimos validar el desbloqueo" },
        { status: 400 }
      );
    }

    // Contador anti-replay + último uso (se ve en Perfil).
    cred.counter = verificacion.authenticationInfo.newCounter;
    cred.ultimoUsoEn = new Date();
    await repo.save(cred);

    await olvidarDesafio();
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: `No pudimos validar el desbloqueo: ${mensaje}` },
      { status: 400 }
    );
  }
}
