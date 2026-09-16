"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint, Loader2, Lock } from "lucide-react";
import Logo from "@/components/layout/logo";
import { clearAllCaches } from "@/lib/pwa";
import { leerGraciaMs } from "@/lib/app-lock-prefs";
import { NO_REMEMBER, PENDING_CLEAR } from "@/lib/session-flags";
import {
  desbloquearConBiometria,
  esDispositivoMovil,
  webAuthnUsable,
} from "@/lib/webauthn-client";

/**
 * BLOQUEO DE LA APP al reanudar desde segundo plano (2026-09-15).
 *
 * El problema: en mobile "cerrar" una app casi nunca la termina. iOS/Android la
 * dejan viva en segundo plano y al volver se reanuda la pantalla **tal cual**:
 * React no se remonta (el `SessionGuard` no corre), no hay navegación (el proxy
 * no corre) y la sesión sigue viva ⇒ se entra sin contraseña ni biometría. Solo
 * el cierre REAL de la app dispara el pedido de ingreso.
 *
 * La solución es la Page Visibility API: `visibilitychange` SÍ se dispara al ir
 * y volver del segundo plano (`pagehide` no: es de descarga de página).
 * - Al pasar a `hidden` (con passkey activada en este equipo) se tapa la pantalla
 *   con este overlay, así el selector de apps muestra el candado y no los saldos.
 * - Al volver a `visible` se pide la biometría del dispositivo y se verifica
 *   contra el servidor (`/api/auth/webauthn/unlock/*`, con
 *   `userVerification: "required"`) antes de volver a mostrar la pantalla.
 *
 * Alcance (pedido del usuario): SOLO mobile —en escritorio el cambio de ventana
 * es lo normal y queda fuera de discusión— y solo si este dispositivo tiene una
 * passkey **del usuario logueado** (`habilitado`, resuelto en el servidor): sin
 * passkey, bloquear sería dejar al usuario afuera.
 *
 * La **gracia** (cuánto puede estar en segundo plano sin bloquearse) es una
 * preferencia por dispositivo, configurable en Perfil: `lib/app-lock-prefs.ts`.
 *
 * ⚠️ Si la sesión venció por **inactividad** (1 h, `lib/session-idle.ts`), el
 * desbloqueo recibe 401 y la app manda a `/login`: ahí la biometría ya no alcanza
 * (la barrera es del servidor, no de esta pantalla).
 *
 * ⚠️ Es una barrera de UI, no de datos: la cookie de sesión no se toca (el
 * desbloqueo no vuelve a loguear). La barrera real de los datos sigue siendo la
 * sesión del servidor.
 */
export function AppLock({ habilitado }: { habilitado: boolean }) {
  const [bloqueado, setBloqueado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  // Espejo de `bloqueado` para leerlo DENTRO del listener de visibilidad sin
  // depender del render (el estado puede cambiar en el mismo evento).
  const bloqueadoRef = useRef(false);
  /** Cuándo pasó a `hidden` (null = nunca / ya procesado). */
  const ocultoEn = useRef<number | null>(null);
  /** Hay una ceremonia WebAuthn en curso (el prompt del SO dispara eventos). */
  const ceremonia = useRef(false);
  /** Último desbloqueo exitoso (para ignorar los eventos del propio prompt). */
  const ultimoExito = useRef(0);

  const bloquear = useCallback(() => {
    if (bloqueadoRef.current) return;
    bloqueadoRef.current = true;
    setBloqueado(true);
    setError("");
  }, []);

  const soltar = useCallback(() => {
    bloqueadoRef.current = false;
    setBloqueado(false);
    setError("");
  }, []);

  const desbloquear = useCallback(async () => {
    if (ceremonia.current) return;
    ceremonia.current = true;
    setCargando(true);
    setError("");
    try {
      const resultado = await desbloquearConBiometria();
      // La sesión venció mientras la app estaba en segundo plano: no hay nada
      // que desbloquear, hay que volver a ingresar.
      if (resultado.sesionVencida) {
        window.location.replace("/login");
        return;
      }
      if (!resultado.ok) {
        setError(resultado.error ?? "No pudimos desbloquear");
        return;
      }
      ultimoExito.current = Date.now();
      soltar();
    } finally {
      ceremonia.current = false;
      setCargando(false);
    }
  }, [soltar]);

  useEffect(() => {
    if (!habilitado) return;
    if (!esDispositivoMovil()) return; // escritorio queda fuera de alcance
    if (!webAuthnUsable()) return; // sin HTTPS/API no hay desbloqueo posible

    const onVisibility = () => {
      const ahora = Date.now();

      // En Android el prompt biométrico del sistema puede pasar la página a
      // `hidden` y devolverla: si hay una ceremonia en curso (o recién terminó)
      // esos eventos son propios y no cuentan como "el usuario se fue".
      if (ceremonia.current || ahora - ultimoExito.current < IGNORAR_MS) return;

      // Cuánto puede estar en segundo plano sin bloquearse. Se lee ACÁ (y no al
      // montar) para que el cambio hecho en Perfil rija al instante. Con 0 se
      // bloquea ya (y no al volver), así el selector de apps muestra el candado
      // en lugar de la pantalla con los saldos.
      const gracia = leerGraciaMs();

      if (document.visibilityState === "hidden") {
        ocultoEn.current = ahora;
        if (gracia === 0) bloquear();
        return;
      }

      // Volvió a `visible`.
      const oculto = ocultoEn.current;
      ocultoEn.current = null;
      if (oculto === null) return;

      // Sin red no se puede verificar la biometría contra el servidor: se deja
      // pasar en modo lectura offline (misma decisión que `SessionGuard`).
      if (!navigator.onLine) {
        soltar();
        return;
      }

      // Ya se había bloqueado al ocultar: solo falta pedir la biometría.
      if (bloqueadoRef.current) {
        void desbloquear();
        return;
      }

      if (ahora - oculto < gracia) return;
      bloquear();
      void desbloquear();
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [habilitado, bloquear, soltar, desbloquear]);

  // Con el overlay arriba, la pantalla de atrás no debe scrollear.
  useEffect(() => {
    if (!bloqueado) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [bloqueado]);

  /** Salida: la contraseña siempre tiene que poder entrar (igual que en Perfil). */
  async function salir() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* se navega igual */
    } finally {
      // Logout VOLUNTARIO ⇒ se borra TODO el caché (los documentos guardados
      // tienen montos y nombres) y no queda nada del usuario en el equipo.
      await clearAllCaches();
      sessionStorage.removeItem(NO_REMEMBER);
      sessionStorage.removeItem(PENDING_CLEAR);
      window.location.replace("/login");
    }
  }

  if (!bloqueado) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aplicación bloqueada"
      className="fixed inset-0 z-100 flex flex-col items-center justify-center gap-5 bg-background px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center"
    >
      <Logo size={17} />

      <div className="flex flex-col items-center gap-2">
        <Lock className="h-5 w-5 text-subtitle" />
        <h2 className="text-[15px] font-semibold text-header">
          Aplicación bloqueada
        </h2>
        <p className="max-w-70 text-[13px] text-subtitle">
          Desbloqueá con biometría para seguir donde estabas.
        </p>
      </div>

      <div className="flex w-full max-w-70 flex-col gap-2.5">
        <button
          type="button"
          onClick={() => void desbloquear()}
          disabled={cargando}
          className="flex items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {cargando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Fingerprint className="h-4 w-4" />
          )}
          {cargando ? "Esperando biometría..." : "Desbloquear"}
        </button>

        {error && <p className="text-[11.5px] text-danger">{error}</p>}

        <button
          type="button"
          onClick={() => void salir()}
          disabled={cargando}
          className="text-[12.5px] font-medium text-subtitle underline underline-offset-2 transition-colors hover:text-card-foreground disabled:opacity-50"
        >
          Ingresar con contraseña
        </button>
      </div>
    </div>
  );
}

/**
 * Ventana en la que se ignoran eventos de visibilidad propios (prompt del SO).
 */
const IGNORAR_MS = 2000;
