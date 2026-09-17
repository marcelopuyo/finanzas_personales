"use client";

import { useEffect } from "react";

/**
 * SESIÓN VENCIDA EN UNA SERVER ACTION (2026-09-17).
 *
 * El agujero: la ventana de inactividad (1 h, `lib/session-idle.ts`) se evalúa
 * en el proxy. Cuando el usuario deja una pestaña de escritorio abierta más de
 * una hora y después toca "Guardar" (una Server Action), el proxy responde 307
 * a `/login` y la acción **nunca corre**: el cliente muestra un error genérico
 * ("Algo salió mal" / "Failed to fetch") y el usuario no entiende que solo tiene
 * que volver a ingresar.
 *
 * Solución: interceptar el `fetch` global y, si la petición era una Server
 * Action (header `Next-Action`) y la respuesta terminó **redirigida a /login**,
 * mandar la ventana a `/login?expirada=1` (que muestra el aviso).
 *
 * Por qué NO se interceptan las navegaciones normales: cuando el redirect viene
 * de un RSC/navegación, el propio router de Next ya resuelve la redirección y
 * llevaría a `/login`; interceptar ahí podría producir redirecciones espurias
 * (p. ej. cerrar sesión en otra pestaña). Solo las Server Actions quedan
 * huérfanas, así que el filtro es `Next-Action`.
 *
 * ⚠️ Es un parche de compatibilidad, no una barrera: la barrera real sigue
 * siendo la sesión del servidor.
 */
export function SessionExpiredWatcher() {
  useEffect(() => {
    instalarInterceptor();
  }, []);

  return null;
}

/** Se instala UNA sola vez (el parche es global y no se desinstala). */
let instalado = false;

function instalarInterceptor() {
  if (instalado || typeof window === "undefined") return;
  instalado = true;

  const original = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await original(...args);
    try {
      if (
        res.redirected &&
        esServerAction(args[0], args[1]) &&
        !enLoginOregister() &&
        new URL(res.url, window.location.href).pathname === "/login"
      ) {
        // La sesión se cayó: la Server Action no llegó a ejecutarse.
        window.location.replace("/login?expirada=1");
      }
    } catch {
      /* el interceptor nunca debe romper el fetch */
    }
    return res;
  };
}

/** ¿La petición es una Server Action? (Next manda el hash en `Next-Action`). */
function esServerAction(input: RequestInfo | URL, init?: RequestInit): boolean {
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined)
  );
  return headers.has("next-action");
}

/** Ya estamos en una pantalla pública: no hay nada que redirigir. */
function enLoginOregister(): boolean {
  const p = window.location.pathname;
  return p === "/login" || p === "/register";
}
