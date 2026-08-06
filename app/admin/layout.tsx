import { redirect } from "next/navigation";
import { getSessionUser } from "@/backend/src/lib/auth";
import AdminShell from "@/components/admin/admin-shell";

// Layout del panel de administración: ruta separada de la app, solo para
// usuarios con esAdmin=true. (El proxy ya exige sesión; acá se exige admin.)
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  if (!user?.esAdmin) redirect("/dashboard");

  return (
    <AdminShell nombre={user.nombre ?? user.email} email={user.email}>
      {children}
    </AdminShell>
  );
}
