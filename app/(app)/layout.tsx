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

  // Primera letra del nombre/email para el avatar de "Perfil" en el sidebar.
  const initial = (user.nombre ?? user.email ?? "U").charAt(0).toUpperCase();

  return <AppLayout initial={initial}>{children}</AppLayout>;
}
