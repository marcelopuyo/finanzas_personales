import { redirect } from "next/navigation";

/**
 * **`/dashboard/mas` ya no es una pantalla** (2026-10-01): el botón "Más" de la
 * barra inferior abre un **popup** y desde ahí se navega a cada funcionalidad.
 * Esta ruta queda solo como redirección para no romper enlaces guardados.
 */
export default function MasRedirect() {
  redirect("/dashboard/prestamos");
}
