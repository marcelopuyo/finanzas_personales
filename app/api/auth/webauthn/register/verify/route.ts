import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getDb } from "@/backend/src/db";
import { WebauthnCredential } from "@/backend/src/entities/webauthn-credential.entity";
import { getSessionUser } from "@/backend/src/lib/auth";
import {
  getWebAuthnConfig,
  guardarPistaCredencial,
  leerDesafio,
  olvidarDesafio,
} from "@/backend/src/lib/webauthn";

/**
 * Paso 2 del alta: verifica la respuesta del autenticador y guarda la
 * credencial (clave PÚBLICA + contador). Requiere sesión.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    response?: unknown;
    nombre?: string;
  } | null;
  if (!body?.response) {
    return NextResponse.json({ error: "Respuesta inválida" }, { status: 400 });
  }

  const desafio = await leerDesafio();
  // El desafío tiene que existir, ser de este usuario y no estar vencido.
  if (!desafio || desafio.userId !== user.id) {
    return NextResponse.json(
      { error: "El desafío venció. Probá de nuevo." },
      { status: 400 }
    );
  }

  const { rpID, origin } = await getWebAuthnConfig();

  try {
    const verificacion = await verifyRegistrationResponse({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response: body.response as any,
      expectedChallenge: desafio.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verificacion.verified) {
      return NextResponse.json(
        { error: "No se pudo verificar el dispositivo" },
        { status: 400 }
      );
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verificacion.registrationInfo;

    const ds = await getDb();
    const repo = ds.getRepository(WebauthnCredential);
    await repo.save(
      repo.create({
        credentialId: credential.id,
        // La clave pública se guarda en base64url (la privada NUNCA llega acá).
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: credential.transports?.join(",") ?? null,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        nombre: (body.nombre ?? "Dispositivo").slice(0, 80),
        usuario: { id: user.id },
      })
    );

    await olvidarDesafio();
    // El dispositivo que acaba de activar la biometría puede entrar ya mismo.
    await guardarPistaCredencial(credential.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: `No se pudo guardar la credencial: ${mensaje}` },
      { status: 400 }
    );
  }
}
