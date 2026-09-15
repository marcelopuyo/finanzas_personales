import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getDb } from "@/backend/src/db";
import { WebauthnCredential } from "@/backend/src/entities/webauthn-credential.entity";
import { setAuthCookie } from "@/backend/src/lib/auth";
import {
  getWebAuthnConfig,
  guardarPistaCredencial,
  leerDesafio,
  olvidarDesafio,
  parseTransports,
} from "@/backend/src/lib/webauthn";

/**
 * Paso 2 del login con biometría: verifica la FIRMA con la clave pública
 * guardada y, si es válida, abre la MISMA sesión que el login con contraseña
 * (`setAuthCookie` ⇒ cookie httpOnly con JWT). Todo el resto de la app queda
 * igual (proxy, Server Actions, SessionGuard).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    response?: { id?: string };
    recordar?: boolean;
  } | null;
  const credentialId = body?.response?.id;
  if (!body?.response || !credentialId) {
    return NextResponse.json({ error: "Respuesta inválida" }, { status: 400 });
  }

  const desafio = await leerDesafio();
  if (!desafio) {
    return NextResponse.json(
      { error: "El desafío venció. Probá de nuevo." },
      { status: 400 }
    );
  }

  // La credencial identifica al usuario (no se pide email: passkey descubrible).
  const ds = await getDb();
  const repo = ds.getRepository(WebauthnCredential);
  const cred = await repo.findOne({
    where: { credentialId, eliminado: false },
    relations: { usuario: true },
  });

  // Se responde siempre lo mismo si la credencial no existe o el usuario está
  // dado de baja: no se filtra información.
  if (!cred || cred.usuario?.eliminado) {
    return NextResponse.json(
      { error: "No pudimos validar el acceso con biometría" },
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
      requireUserVerification: false,
      credential: {
        id: cred.credentialId,
        publicKey: Buffer.from(cred.publicKey, "base64url"),
        counter: cred.counter,
        transports: parseTransports(cred.transports),
      },
    });

    if (!verificacion.verified) {
      return NextResponse.json(
        { error: "No pudimos validar el acceso con biometría" },
        { status: 400 }
      );
    }

    // Contador anti-replay + registro del último uso (se ve en Perfil).
    cred.counter = verificacion.authenticationInfo.newCounter;
    cred.ultimoUsoEn = new Date();
    await repo.save(cred);

    await setAuthCookie(cred.usuario.id, body.recordar === true);
    // Este dispositivo queda "marcado" con esa credencial (login en un toque).
    await guardarPistaCredencial(cred.credentialId);
    await olvidarDesafio();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: `No pudimos validar el acceso con biometría: ${mensaje}` },
      { status: 400 }
    );
  }
}
