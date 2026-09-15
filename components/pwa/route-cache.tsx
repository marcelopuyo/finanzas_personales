"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { SW_MSG } from "@/lib/pwa";

/**
 * Le pide al service worker que guarde (y **refresque**) el documento de la
 * pantalla actual en cada ingreso.
 *
 * Por qué hace falta: en una app de Next las navegaciones son **de cliente**
 * (RSC) y NO generan una petición de documento, así que sin esto la caché
 * offline quedaría casi vacía (solo la pantalla de arranque, y solo si hubo una
 * carga completa de página). El SW hace el fetch él mismo, con las credenciales
 * de la sesión, así que el documento guardado es siempre una versión completa y
 * al día del último ingreso (decisión del usuario, 2026-09-15).
 *
 * Se monta SOLO en el área autenticada: `/login` y `/register` nunca se cachean.
 */
export function RouteCache() {
  const pathname = usePathname();

  useEffect(() => {
    const controller = navigator.serviceWorker?.controller;
    // Sin SW (dev sin `?sw=1`) o sin red no hay nada que refrescar.
    if (!controller || !navigator.onLine) return;
    // La URL real (con query) es la que después tiene que matchear la navegación:
    // `usePathname()` por sí solo perdería `?origen=dashboard`, `?estado=cobrado`, etc.
    controller.postMessage({
      type: SW_MSG.cacheRoute,
      url: `${window.location.pathname}${window.location.search}`,
    });
  }, [pathname]);

  return null;
}
