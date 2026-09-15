"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { PWA_SW_URL, SW_MSG } from "@/lib/pwa";
import { APP_BUILD_ID, APP_VERSION } from "@/lib/version";
import { captureInstallPrompt } from "@/lib/pwa-install";

/**
 * Registro del service worker (PWA) + aviso de versión nueva.
 *
 * Se monta en el layout RAÍZ (una sola vez por sesión de página) y no dibuja
 * nada. Reglas:
 * - Solo se registra en PRODUCCIÓN: en `next dev` el SW sirve caché que ya no
 *   corresponde al HMR y genera bugs fantasma difíciles de rastrear.
 * - Para el QA hay dos interruptores por query string:
 *   `?sw=1` lo activa en desarrollo y `?sw=0` lo desregistra y limpia todo.
 * - Cuando hay una versión nueva esperando, se muestra un toast con "Recargar":
 *   el usuario decide el momento (no se corta un formulario a medio escribir).
 *   Si la ignora, igual entra al cerrar y reabrir la app.
 */
export function SwRegister() {
  useEffect(() => {
    // Captura global del prompt de instalación (el botón vive en Perfil).
    captureInstallPrompt();

    if (!("serviceWorker" in navigator)) return;

    const flag = new URLSearchParams(window.location.search).get("sw");

    // ?sw=0 → desregistrar y limpiar todo (QA en el celular).
    if (flag === "0") {
      void (async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((r) => r.unregister()));
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
          toast.success("Service worker desregistrado. Recargá para ver los cambios.");
        } catch {
          toast.error("No se pudo desregistrar el service worker.");
        }
      })();
      return;
    }

    // En desarrollo hay que pedirlo explícitamente con ?sw=1.
    if (process.env.NODE_ENV !== "production" && flag !== "1") return;

    let cancelled = false;

    // Avisarle al SW qué build está corriendo la app: si es distinto al suyo,
    // descarta los documentos cacheados de la versión anterior. Sin controller
    // (primera carga) el mensaje no llega a nadie: el SW ya se enteró al
    // instalarse leyendo `/version.json`.
    const avisarBuild = () => {
      navigator.serviceWorker.controller?.postMessage({
        type: SW_MSG.build,
        buildId: APP_BUILD_ID,
      });
    };
    avisarBuild();
    navigator.serviceWorker.addEventListener("controllerchange", avisarBuild);

    void (async () => {
      try {
        const registration = await navigator.serviceWorker.register(PWA_SW_URL, {
          scope: "/",
        });
        if (cancelled) return;
        avisarBuild();

        if (registration.waiting && navigator.serviceWorker.controller) {
          showUpdateToast(registration);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          installing?.addEventListener("statechange", () => {
            // `controller` distingue una ACTUALIZACIÓN de la primera instalación
            // (en la primera no hay nada que recargar).
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              showUpdateToast(registration);
            }
          });
        });
      } catch (error) {
        console.warn("[pwa] no se pudo registrar el service worker", error);
      }
    })();

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", avisarBuild);
    };
  }, []);

  return null;
}

function showUpdateToast(registration: ServiceWorkerRegistration) {
  toast("Nueva versión disponible", {
    id: "pwa-update",
    description: `Recargá para actualizar la app · estás en la ${APP_VERSION}.`,
    // Queda en pantalla hasta que el usuario decida (no se autodestruye).
    duration: Infinity,
    action: {
      label: "Recargar",
      onClick: () => {
        // Al dejar de esperar, el SW nuevo toma el control → recargamos una sola vez.
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => window.location.reload(),
          { once: true }
        );
        registration.waiting?.postMessage({ type: SW_MSG.skipWaiting });
      },
    },
  });
}
