"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint, Loader2, Lock } from "lucide-react";
import Logo from "@/components/layout/logo";
import { clearAllCaches } from "@/lib/pwa";
import { servidorResponde } from "@/lib/net";
import { leerGraciaMs } from "@/lib/app-lock-prefs";
import { NO_REMEMBER, PENDING_CLEAR } from "@/lib/session-flags";
import {
  desbloquearConBiometria,
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
 * ⚠️ Alcance (ampliado el 2026-09-17 por decisión del usuario): aplica en
 * **TODOS los dispositivos**, mobile y **escritorio**. Originalmente era solo
 * mobile —ahí "cerrar" la app no la termina y se reanudaba sin pedir nada—, pero
 * el usuario pidió extenderlo: en escritorio el candado se arma al volver de
 * otra pestaña/ventana (según la **gracia**) y **siempre** en un arranque en
 * frío. Se arma solo si este dispositivo tiene una passkey **del usuario
 * logueado** (`habilitado`, resuelto en el servidor): sin passkey, bloquear
 * sería dejar al usuario afuera.
 *
 * La **gracia** (cuánto puede estar en segundo plano sin bloquearse) es una
 * preferencia por dispositivo, configurable en Perfil: `lib/app-lock-prefs.ts`.
 *
 * **Arranque en frío** (abrir la app que estaba cerrada, recargar, deep link): el
 * candado viene PUESTO desde el servidor (`useState(habilitado)`, y el layout raíz
 * renderiza este overlay ANTES del contenido) para que el primer paint ya sea el
 * bloqueo y no se vea ni un frame de la pantalla: el bug reportado el 2026-09-15
 * era justamente que el dashboard se veía 1-2 s hasta que el sistema avisaba el
 * `visibilitychange`. Ojo: **el arranque bloquea siempre**; la gracia aplica solo
 * al volver del segundo plano.
 *
 * ⚠️ Si la sesión venció por **inactividad** (1 h, `lib/session-idle.ts`), el
 * desbloqueo recibe 401 y la app manda a `/login`: ahí la biometría ya no alcanza
 * (la barrera es del servidor, no de esta pantalla).
 *
 * ⚠️ **Sin servidor (endurecido el 2026-09-17 por decisión del usuario)**: hay
 * que distinguir DOS casos, porque no significan lo mismo:
 *  · **Sin conexión** (`navigator.onLine === false`): el candado se SUELTA y la
 *    app queda en **modo lectura offline** (§96) — es una función, no un fallo.
 *    El `fp-sin-red` que pone el script del `<head>` evita que el candado
 *    parpadee en un arranque offline.
 *  · **Con red pero sin respuesta del servidor** (app caída, proxy 502/503,
 *    portal cautivo): el candado **SE QUEDA PUESTO** con el aviso, porque sin
 *    servidor no hay forma de validar la firma. Se reintenta solo cada
 *    `SIN_SERVIDOR_REINTENTO_MS` y también al volver la conexión, así que se
 *    desbloquea apenas el servidor responda.
 *
 * ⚠️ Es una barrera de UI, no de datos: la cookie de sesión no se toca (el
 * desbloqueo no vuelve a loguear). La barrera real de los datos sigue siendo la
 * sesión del servidor.
 */
export function AppLock({ habilitado }: { habilitado: boolean }) {
  // Arranque: si este equipo tiene passkey, el bloqueo arranca PUESTO (igual que
  // en el HTML del servidor: mismo valor ⇒ no hay desajuste de hidratación).
  const [bloqueado, setBloqueado] = useState(habilitado);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  /**
   * Hay red pero el SERVIDOR no responde: el candado se queda puesto con el
   * aviso y se reintenta solo (decisión del usuario, 2026-09-17).
   */
  const [sinServidor, setSinServidor] = useState(false);

  // Espejo de `bloqueado` para leerlo DENTRO del listener de visibilidad sin
  // depender del render (el estado puede cambiar en el mismo evento).
  const bloqueadoRef = useRef(habilitado);
  /** Cuándo pasó a `hidden` (null = nunca / ya procesado). */
  const ocultoEn = useRef<number | null>(null);
  /** Hay una ceremonia WebAuthn en curso (el prompt del SO dispara eventos). */
  const ceremonia = useRef(false);
  /** Último desbloqueo exitoso (para ignorar los eventos del propio prompt). */
  const ultimoExito = useRef(0);
  /** Espejo de `sinServidor` para leerlo sin depender del render. */
  const sinServidorRef = useRef(false);

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

  /** Marca/limpia el estado "el servidor no responde" (ref + estado). */
  const marcarSinServidor = useCallback((v: boolean) => {
    sinServidorRef.current = v;
    setSinServidor(v);
  }, []);

  const desbloquear = useCallback(async () => {
    if (ceremonia.current) return;

    // Si ya sabemos que el servidor no responde, no tiene sentido abrir el
    // prompt del sistema: se sondea primero y, si ya volvió, seguimos.
    if (sinServidorRef.current) {
      if (!(await servidorResponde())) return;
      marcarSinServidor(false);
    }

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
        // Hay RED pero el SERVIDOR no contesta (app caída, proxy roto, portal
        // cautivo): el candado NO se libera (decisión del usuario 2026-09-17),
        // se queda con el aviso y se reintenta solo. La sonda distingue este
        // caso de un error puntual de la ruta.
        if (resultado.sinServidor && !(await servidorResponde())) {
          marcarSinServidor(true);
          return;
        }
        setError(resultado.error ?? "No pudimos desbloquear");
        return;
      }
      marcarSinServidor(false);
      ultimoExito.current = Date.now();
      soltar();
    } finally {
      ceremonia.current = false;
      setCargando(false);
    }
  }, [marcarSinServidor, soltar]);

  // CONECTIVIDAD (2026-09-17). Dos cosas:
  // 1) La clase `fp-sin-red` la agrega el script del <head> ANTES del primer
  //    paint cuando el navegador ya sabe que no hay red, y el CSS oculta el
  //    candado: así un arranque offline no muestra ni un frame del cerrojo
  //    (antes aparecía y se liberaba al montar = parpadeo). Acá se mantiene
  //    sincronizada con el estado real de la conexión.
  // 2) Al volver la conexión, si el candado está puesto se intenta el desbloqueo
  //    sin esperar a un `visibilitychange` (antes quedaba esperando un evento).
  useEffect(() => {
    const marcar = () =>
      document.documentElement.classList.toggle(
        "fp-sin-red",
        navigator.onLine === false
      );
    const onOnline = () => {
      marcar();
      if (habilitado && bloqueadoRef.current) void desbloquear();
    };
    const onOffline = () => {
      marcar();
      // Sin red no hay verificación posible: modo lectura (§96). El caso "hay
      // red pero el server no responde" deja de aplicar (ahora es offline).
      marcarSinServidor(false);
      if (bloqueadoRef.current) soltar();
    };

    marcar();
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [habilitado, desbloquear, marcarSinServidor, soltar]);

  // REINTENTO AUTOMÁTICO con el servidor caído: el candado quedó puesto, así que
  // se sondea cada `SIN_SERVIDOR_REINTENTO_MS` y, apenas el servidor responda, se
  // pide la biometría y se desbloquea solo (2026-09-17).
  useEffect(() => {
    if (!bloqueado || !sinServidor) return;
    const id = setInterval(() => void desbloquear(), SIN_SERVIDOR_REINTENTO_MS);
    return () => clearInterval(id);
  }, [bloqueado, sinServidor, desbloquear]);

  useEffect(() => {
    if (!habilitado) return;
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

      // Sin red no se puede verificar la biometría contra el servidor: se deja
      // pasar en modo lectura offline (misma decisión que `SessionGuard`).
      if (!navigator.onLine) {
        marcarSinServidor(false);
        soltar();
        return;
      }

      // El bloqueo YA está puesto (arranque en frío, o gracia 0 al ocultar):
      // solo falta pedir la biometría. Va ANTES del chequeo de `oculto` porque
      // en un arranque puede no haber habido ningún `hidden` en esta sesión.
      if (bloqueadoRef.current) {
        void desbloquear();
        return;
      }

      if (oculto === null) return;
      if (ahora - oculto < gracia) return;
      bloquear();
      void desbloquear();
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [habilitado, bloquear, marcarSinServidor, soltar, desbloquear]);

  // ARRANQUE EN FRÍO: el overlay ya viene del servidor; acá se resuelve si se
  // puede desbloquear. Se espera un instante para que la pantalla se pinte y la
  // app termine de hidratar antes de abrir el prompt del sistema.
  useEffect(() => {
    if (!habilitado) return;
    const id = setTimeout(() => {
      if (!bloqueadoRef.current) return;
      // El candado dejó de aplicar (p.ej. revocaron la passkey en este equipo):
      // no se puede quedar trabado en una pantalla sin salida.
      if (!habilitado) {
        soltar();
        return;
      }
      // Sin red: modo lectura offline (§96).
      if (!navigator.onLine) {
        marcarSinServidor(false);
        soltar();
        return;
      }
      // Si el documento todavía no está visible, el intento lo hace el handler
      // de visibilidad (no tiene sentido abrir un prompt en segundo plano).
      if (document.visibilityState !== "visible") return;
      // Si el servidor no responde, `desbloquear()` lo detecta (sonda) y el
      // candado queda puesto con el aviso + reintento automático.
      void desbloquear();
    }, ARRANQUE_MS);
    return () => clearTimeout(id);
  }, [habilitado, marcarSinServidor, soltar, desbloquear]);

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
    let respondio = false;
    try {
      // Cualquier respuesta del servidor (incluso un 401) confirma que el logout
      // llegó; si la promesa falla, es porque NO hubo respuesta.
      await fetch("/api/auth/logout", { method: "POST" });
      respondio = true;
    } catch {
      /* se navega igual */
    } finally {
      // Logout VOLUNTARIO ⇒ se borra TODO el caché (los documentos guardados
      // tienen montos y nombres) y no queda nada del usuario en el equipo. ⚠️ Solo
      // si el servidor CONFIRMÓ el cierre (2026-09-17): sin respuesta no sabemos
      // si la sesión quedó viva y borrar el caché dejaría al usuario sin el modo
      // lectura offline (§96).
      if (respondio) await clearAllCaches();
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
      // Marca para el CSS: con la clase `fp-sin-red` en <html> (sin conexión) el
      // candado NO se pinta (modo lectura).
      data-app-lock=""
      className="fixed inset-0 z-100 flex flex-col items-center justify-center gap-5 bg-background px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center"
    >
      <Logo size={17} />

      <div className="flex flex-col items-center gap-2">
        <Lock className="h-5 w-5 text-subtitle" />
        <h2 className="text-[15px] font-semibold text-header">
          Aplicación bloqueada
        </h2>
        <p className="max-w-70 text-[13px] text-subtitle">
          {sinServidor
            ? "El servidor no responde: no podemos verificar tu biometría. Se va a desbloquear solo cuando vuelva la conexión."
            : "Desbloqueá con biometría para seguir donde estabas."}
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
          {cargando
            ? "Esperando biometría..."
            : sinServidor
              ? "Reintentar"
              : "Desbloquear"}
        </button>

        {error && <p className="text-[11.5px] text-danger">{error}</p>}

        {/* Con el servidor caído el logout tampoco llega: mandar a /login no
            sirve (el proxy devuelve al dashboard y el candado vuelve a aparecer).
            Se muestra el reintento automático en su lugar. */}
        {sinServidor ? (
          <p className="text-[11.5px] text-subtitle">
            Reintentando automáticamente cada pocos segundos…
          </p>
        ) : (
          <button
            type="button"
            onClick={() => void salir()}
            disabled={cargando}
            className="text-[12.5px] font-medium text-subtitle underline underline-offset-2 transition-colors hover:text-card-foreground disabled:opacity-50"
          >
            Ingresar con contraseña
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Ventana en la que se ignoran eventos de visibilidad propios (prompt del SO).
 */
const IGNORAR_MS = 2000;

/**
 * Cada cuánto se reintenta el desbloqueo mientras el servidor no responde
 * (decisión del usuario 2026-09-17: el candado ya NO se libera en ese caso).
 * La sonda es un `HEAD /api/ping` barato, así que puede ser frecuente.
 */
const SIN_SERVIDOR_REINTENTO_MS = 15_000;

/**
 * Espera antes de pedir la biometría en un arranque en frío: deja que se pinte la
 * pantalla de bloqueo y que la app termine de hidratar.
 */
const ARRANQUE_MS = 250;
