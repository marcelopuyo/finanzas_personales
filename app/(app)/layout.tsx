import { redirect } from "next/navigation";
import { getSessionUser } from "@/backend/src/lib/auth";
import AppLayout from "@/components/layout/app-layout";

// Layout del grupo protegido (app): si no hay sesión válida, redirige a /login.
// Luego renderiza el AppLayout con el sidebar.
export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Etiqueta dinámica del item "Perfil" del sidebar: nombre del usuario
  // logueado (o su email si no tiene nombre), y la primera letra para el avatar.
  const userLabel = (user.nombre?.trim() || user.email || "Perfil").trim();
  const initial = userLabel.charAt(0).toUpperCase();

  return (
    <AppLayout initial={initial} userLabel={userLabel}>
      {children}
    </AppLayout>
  );
}
