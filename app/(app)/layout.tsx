import { redirect } from "next/navigation";
import { getSessionUserId } from "@/backend/src/lib/auth";
import AppLayout from "@/components/layout/app-layout";

// Layout del grupo protegido (app): si no hay sesión válida, redirige a /login.
// Luego renderiza el AppLayout con el sidebar.
export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  return <AppLayout>{children}</AppLayout>;
}
