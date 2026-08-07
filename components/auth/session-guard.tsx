"use client";

import { useEffect } from "react";
import { NO_REMEMBER, PENDING_CLEAR } from "@/lib/session-flags";

/**
 * Guardia de sesión "por pestaña" para sesiones iniciadas SIN "mantener la sesión".
 *
 * Objetivo:
 * - Cerrar la pestaña (o el navegador) → la sesión muere → hay que volver a loguearse.
 * - Recargar la página (F5) → NO desloguea.
 *
 * Cómo funciona:
 * - Si en esta pestaña hay una sesión "no recordar" (flag en sessionStorage), se
 *   registra un listener `pagehide`.
 * - Al cerrar/recargar (pagehide sin bfcache): se marca `fp_pending_clear` y se
 *   expira la cookie vía `POST /api/auth/temp-clear` (maxAge 5s).
 * - Si al montar existe `fp_pending_clear` → es un refresh en la MISMA pestaña
 *   (sessionStorage sobrevive al refresh): se renueva la cookie con
 *   `POST /api/auth/renew` antes de que expire. En una pestaña NUEVA el flag no
 *   existe → la cookie ya expiró → se pide login.
 */
export function SessionGuard() {
  useEffect(() => {
    if (sessionStorage.getItem(NO_REMEMBER) !== "1") return;

    // ¿Viene de un refresh en la misma pestaña? Renovar la cookie antes de que expire.
    if (sessionStorage.getItem(PENDING_CLEAR) === "1") {
      sessionStorage.removeItem(PENDING_CLEAR);
      // Pequeño delay: deja que el temp-clear (enviado antes) se aplique primero,
      // así el renew queda como último write y la cookie vuelve a ser de sesión.
      setTimeout(() => {
        fetch("/api/auth/renew", { method: "POST" }).catch(() => {});
      }, 300);
    }

    const onPageHide = (e: PageTransitionEvent) => {
      // back/forward con bfcache: no cortar la sesión.
      if (e.persisted) return;
      sessionStorage.setItem(PENDING_CLEAR, "1");
      fetch("/api/auth/temp-clear", {
        method: "POST",
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  return null;
}
