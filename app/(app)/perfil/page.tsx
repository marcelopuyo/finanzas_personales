import { redirect } from "next/navigation";
import { getSessionUser } from "@/backend/src/lib/auth";
import PerfilClient from "./perfil-client";

// Página de perfil del usuario (acceso vía item "Perfil" del sidebar).
export default async function PerfilPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

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
    />
  );
}
