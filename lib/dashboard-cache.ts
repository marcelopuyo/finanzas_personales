"use client";

/** Secciones principales que se precargan y conservan para uso offline. */
export const DASHBOARD_SECTION_PATHS = [
  "/dashboard",
  "/dashboard/gastos",
  "/dashboard/ingresos",
  "/dashboard/resultados",
] as const;

export const DASHBOARD_CACHE_REFRESH_EVENT = "fp:dashboard-cache-refresh";

/** Solicita revalidar las secciones después de una escritura local confirmada. */
export function solicitarActualizacionDashboard(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DASHBOARD_CACHE_REFRESH_EVENT));
  }
}
