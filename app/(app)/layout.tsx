import { redirect } from "next/navigation";
import { getSessionUser } from "@/backend/src/lib/auth";
import AppLayout from "@/components/layout/app-layout";

// Layout del grupo protegido (app): si no hay sesión válida, redirige a /login.
// Luego renderiza el AppLayout (top bar global con logo → Resumen y avatar →
// Perfil). No hay sidebar lateral.
export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Etiqueta del usuario (tooltip/aria del avatar de la top bar): nombre del
  // usuario logueado (o su email si no tiene nombre), y su primera letra.
  const userLabel = (user.nombre?.trim() || user.email || "Perfil").trim();
  const initial = userLabel.charAt(0).toUpperCase();

  return (
    <AppLayout initial={initial} userLabel={userLabel}>
      {children}
    </AppLayout>
  );
}
