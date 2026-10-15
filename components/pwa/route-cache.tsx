"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { SW_MSG } from "@/lib/pwa";
import {
  DASHBOARD_CACHE_REFRESH_EVENT,
  DASHBOARD_SECTION_PATHS,
} from "@/lib/dashboard-cache";
import { invalidarCacheSeccionesDashboard } from "@/app/(app)/dashboard/cache-actions";

const RETRY_DELAYS_MS = [1000, 3000, 8000, 30000];

function cachearRutasDashboard(force = false): void {
  const controller = navigator.serviceWorker?.controller;
  if (!controller) return;

  for (const url of DASHBOARD_SECTION_PATHS) {
    controller.postMessage({ type: SW_MSG.cacheRoute, url, force });
  }
}

/**
 * Conserva documentos offline para las rutas principales y para las demás
 * pantallas autenticadas.
 *
 * Por qué hace falta: en una app de Next las navegaciones son **de cliente**
 * (RSC) y NO generan una petición de documento, así que sin esto la caché
 * offline quedaría casi vacía (solo la pantalla de arranque, y solo si hubo una
 * carga completa de página). El SW hace el fetch él mismo, con las credenciales
 * de la sesión, así que el documento guardado es siempre una versión completa y
 * actualizados al abrir la app, tras una escritura y al desbloquear.
 *
 * Se monta SOLO en el área autenticada: `/login` y `/register` nunca se cachean.
 */
export function RouteCache() {
  const pathname = usePathname();
  const seccionesPrecargadas = useRef(false);

  useEffect(() => {
    const esSeccionPrincipal = DASHBOARD_SECTION_PATHS.some(
      (path) => pathname === path
    );

    if (esSeccionPrincipal) {
      const precargar = () => {
        if (
          seccionesPrecargadas.current ||
          !navigator.onLine ||
          !navigator.serviceWorker?.controller
        ) {
          return;
        }
        cachearRutasDashboard(true);
        seccionesPrecargadas.current = true;
      };

      precargar();
      navigator.serviceWorker?.addEventListener("controllerchange", precargar);
      return () =>
        navigator.serviceWorker?.removeEventListener(
          "controllerchange",
          precargar
        );
    }

    // El resto de las pantallas conserva su caché offline por ruta.
    const controller = navigator.serviceWorker?.controller;
    if (!controller || !navigator.onLine) return;
    controller.postMessage({
      type: SW_MSG.cacheRoute,
      url: `${window.location.pathname}${window.location.search}`,
    });
  }, [pathname]);

  useEffect(() => {
    let retryTimer: number | undefined;
    let disposed = false;
    let retryIndex = 0;
    let refreshPending = false;
    let inFlight = false;

    const revalidar = async () => {
      if (!navigator.onLine || disposed || inFlight) return;
      inFlight = true;

      try {
        await invalidarCacheSeccionesDashboard();
        if (disposed) return;
        cachearRutasDashboard(true);
        retryIndex = 0;
        refreshPending = false;
      } catch (error) {
        console.warn(
          "[dashboard-cache] no se pudo revalidar; se conserva la caché",
          error
        );
        const delay =
          RETRY_DELAYS_MS[
            Math.min(retryIndex, RETRY_DELAYS_MS.length - 1)
          ];
        retryIndex++;
        retryTimer = window.setTimeout(() => void revalidar(), delay);
      } finally {
        inFlight = false;
      }
    };

    const alSolicitarActualizacion = () => {
      refreshPending = true;
      retryIndex = 0;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      void revalidar();
    };
    const alVolverLaConexion = () => {
      if (refreshPending) alSolicitarActualizacion();
    };

    window.addEventListener(
      DASHBOARD_CACHE_REFRESH_EVENT,
      alSolicitarActualizacion
    );
    window.addEventListener("online", alVolverLaConexion);
    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      window.removeEventListener(
        DASHBOARD_CACHE_REFRESH_EVENT,
        alSolicitarActualizacion
      );
      window.removeEventListener("online", alVolverLaConexion);
    };
  }, []);

  return null;
}
