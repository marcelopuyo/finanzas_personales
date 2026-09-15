"use client";

import { useCallback, useSyncExternalStore } from "react";
import { isStandalone } from "@/lib/pwa";

/**
 * Captura global del evento `beforeinstallprompt` (PWA instalable).
 *
 * El problema: `beforeinstallprompt` se dispara UNA vez por carga de página y,
 * en una app de una sola página, cuando el usuario llega a Perfil ya pasó — el
 * listener montado ahí lo perdería. Por eso la captura vive en un estado de
 * módulo que instala `SwRegister` (global, en el layout raíz) y el botón de
 * Perfil solo consume el resultado.
 *
 * En iOS Safari el evento NO existe: ahí la instalación es manual
 * (Compartir → Añadir a pantalla de inicio), por eso el botón muestra
 * instrucciones en vez de disparar un prompt.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let captured = false;

const listeners = new Set<() => void>();

// Snapshot estable: `useSyncExternalStore` necesita la MISMA referencia mientras
// nada cambie (si se devolviera un objeto nuevo en cada render, habría loop).
let snapshot: { canPrompt: boolean; installed: boolean } = {
  canPrompt: false,
  installed: false,
};

function emit() {
  snapshot = { canPrompt: deferred !== null, installed };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

/** Registra los listeners una sola vez (idempotente). */
export function captureInstallPrompt(): void {
  if (captured || typeof window === "undefined") return;
  captured = true;

  if (isStandalone()) {
    installed = true;
    emit();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    // Sin preventDefault, Chrome Android muestra su propio mini-infobar.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });

  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

/** Estado de instalación + disparador del prompt nativo. */
export function useInstallPrompt() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferred) return "unavailable";
    const event = deferred;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // El evento es de un solo uso: se descarta pase lo que pase.
    deferred = null;
    emit();
    return outcome;
  }, []);

  return { ...state, promptInstall };
}
