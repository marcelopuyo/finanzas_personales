import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSessionUser } from "@/backend/src/lib/auth";
import { getAllMonedas } from "@/backend/src/queries/maestros";
import { getCredencialesWebauthn } from "@/backend/src/queries/webauthn";
import { LOCK_GRACE_COOKIE, graciaDeValor } from "@/lib/app-lock-prefs";
import PerfilClient from "./perfil-client";

// Página de perfil del usuario (acceso vía item "Perfil" del sidebar).
export default async function PerfilPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const monedas = await getAllMonedas();
  // Passkeys (biometría) del usuario: se listan en su Perfil.
  const credenciales = await getCredencialesWebauthn();
  // Gracia del bloqueo de app guardada en este dispositivo (cookie).
  const store = await cookies();
  const graciaBloqueo = graciaDeValor(store.get(LOCK_GRACE_COOKIE)?.value);
  const monedaPredeterminadaId =
    user.monedaPredeterminada?.id ?? monedas[0]?.id ?? 0;

  const initials = (user.nombre ?? user.email ?? "U")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <PerfilClient
      nombre={user.nombre ?? user.email}
      email={user.email}
      esAdmin={user.esAdmin}
      initials={initials}
      monedas={monedas.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        codigoISO: m.codigoISO,
        codigoPais: m.codigoPais,
      }))}
      monedaPredeterminadaId={monedaPredeterminadaId}
      credenciales={credenciales}
      graciaBloqueo={graciaBloqueo}
    />
  );
}
