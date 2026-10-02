import { redirect } from "next/navigation";

/**
 * **`/trabajo` dejó de ser una pantalla propia** (2026-10-01, rama `rediseno-ui`):
 * su grilla (pendientes por trabajo + cobradas con scroll infinito) es ahora el
 * **listado unificado de la pantalla Ingresos**, debajo del panel de gráficos.
 *
 * La ruta se mantiene como **redirección** para no romper enlaces guardados ni las
 * órdenes de voz que apuntan a los períodos de trabajo.
 */
export default function TrabajoRedirect() {
  redirect("/dashboard/ingresos");
}
