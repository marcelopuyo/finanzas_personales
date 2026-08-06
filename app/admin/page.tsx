import { redirect } from "next/navigation";

// Índice del panel admin → lista de usuarios.
export default function AdminPage() {
  redirect("/admin/usuarios");
}
