import { redirect } from "next/navigation";

/**
 * La pantalla de Préstamos ahora vive en **`/dashboard/prestamos`** (2026-10-01,
 * junto con su grilla). Esta ruta queda solo como redirección.
 */
export default function PrestamosRedirect() {
  redirect("/dashboard/prestamos");
}
