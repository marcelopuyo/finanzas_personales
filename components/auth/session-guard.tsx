"use client";

import { useEffect } from "react";
import { NO_REMEMBER, PENDING_CLEAR } from "@/lib/session-flags";

/**
 * Guardia de sesión "por pestaña" para sesiones iniciadas SIN "mantener la sesión".
 *
 * Objetivo:
 * - Cerrar la app / la pestaña (o el navegador) → la sesión muere → hay que
 *   volver a loguearse (con contraseña o biometría).
 * - Recargar la página (F5) → NO desloguea.
 * - Sesión con "mantener la sesión" → no se toca.
 *
 * Cómo funciona (dos defensas):
 * 1. **Cierre heredado.** Al montar pregunta al servidor de qué tipo es la sesión
 *    (`/api/auth/session-kind`). Si es `temporal` pero esta pestaña **no** tiene el
 *    flag `fp_no_remember` en `sessionStorage`, esa cookie es una **sobra de un
 *    cierre anterior** — pasa en iOS y en las PWA instaladas, que conservan las
 *    cookies "de sesión" entre cierres (y donde `pagehide` no siempre alcanza a
 *    avisar). En ese caso se cierra la sesión y se manda a `/login`.
 * 2. **Cierre limpio.** Con el flag presente, se registra un listener `pagehide`
 *    que expira la cookie vía `POST /api/auth/temp-clear` (gracia de 5 s). Si al
 *    montar existe `fp_pending_clear` es un refresh en la MISMA pestaña: se
 *    renueva la cookie con `POST /api/auth/renew` antes de que muera.
 *
 * `sessionStorage` es por pestaña: sobrevive al refresh pero no a una pestaña
 * nueva. Sin red no se cierra nada: se deja el modo lectura offline (§96).
 */
export function SessionGuard() {
  useEffect(() => {
    let cancelado = false;
    let onPageHide: ((e: PageTransitionEvent) => void) | null = null;

    const armarCierreLimpio = () => {
      // ¿Viene de un refresh en la misma pestaña? Renovar la cookie antes de que expire.
      if (sessionStorage.getItem(PENDING_CLEAR) === "1") {
        sessionStorage.removeItem(PENDING_CLEAR);
        // Pequeño delay: deja que el temp-clear (enviado antes) se aplique primero,
        // así el renew queda como último write y la cookie vuelve a ser de sesión.
        setTimeout(() => {
          fetch("/api/auth/renew", { method: "POST" }).catch(() => {});
        }, 300);
      }

      onPageHide = (e: PageTransitionEvent) => {
        // back/forward con bfcache: no cortar la sesión.
        if (e.persisted) return;
        sessionStorage.setItem(PENDING_CLEAR, "1");
        fetch("/api/auth/temp-clear", {
          method: "POST",
          keepalive: true,
        }).catch(() => {});
      };

      window.addEventListener("pagehide", onPageHide);
    };

    void (async () => {
      try {
        const res = await fetch("/api/auth/session-kind", { cache: "no-store" });
        if (!res.ok) return;
        const { estado } = (await res.json()) as {
          estado?: "none" | "temporal" | "persistente";
        };
        // Sin sesión, o sesión con "mantener la sesión": nada que hacer.
        if (cancelado || estado !== "temporal") return;

        if (sessionStorage.getItem(NO_REMEMBER) !== "1") {
          // Sesión temporal heredada de un cierre anterior: se corta.
          if (!navigator.onLine) return; // sin red no se puede cerrar (modo lectura)
          await fetch("/api/auth/logout", {
            method: "POST",
            keepalive: true,
          }).catch(() => {});
          window.location.replace("/login");
          return;
        }

        armarCierreLimpio();
      } catch {
        /* sin red: no hay nada que decidir */
      }
    })();

    return () => {
      cancelado = true;
      if (onPageHide) window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}
