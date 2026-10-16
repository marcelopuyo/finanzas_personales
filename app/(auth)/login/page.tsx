import { Suspense } from "react";
import { getDb } from "@/backend/src/db";
import { WebauthnCredential } from "@/backend/src/entities/webauthn-credential.entity";
import { leerPistaCredencial } from "@/backend/src/lib/webauthn";
import LoginClient from "./login-client";

export default async function LoginPage() {
  const credentialId = await leerPistaCredencial();
  // Ignora pistas obsoletas y envía al cliente solo el estado, nunca el ID.
  const tienePasskey = credentialId
    ? Boolean(
        await (await getDb())
          .getRepository(WebauthnCredential)
          .findOne({
            where: { credentialId, eliminado: false },
            select: { id: true },
          })
      )
    : false;

  return (
    <Suspense fallback={null}>
      <LoginClient tienePasskey={tienePasskey} />
    </Suspense>
  );
}
