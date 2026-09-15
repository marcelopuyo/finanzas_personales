import { Suspense } from "react";
import LoginClient from "./login-client";
import { passkeyEnEsteDispositivo } from "@/backend/src/queries/webauthn";

export default async function LoginPage() {
  /**
   * El botón de biometría solo se muestra si ESTE dispositivo ya tiene una
   * passkey activada (cookie "pista"). El primer login de un dispositivo es
   * siempre con contraseña: la passkey se activa desde Perfil, ya logueado.
   */
  const passkeyEnDispositivo = await passkeyEnEsteDispositivo();

  return (
    <Suspense fallback={null}>
      <LoginClient passkeyEnDispositivo={passkeyEnDispositivo} />
    </Suspense>
  );
}
