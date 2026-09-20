"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Fingerprint } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { NO_REMEMBER, PENDING_CLEAR } from "@/lib/session-flags";
import { guardarUltimoEmail } from "@/lib/ultimo-email";
import { useUltimoEmail } from "@/lib/use-cliente";
import { entrarConBiometria, estadoBiometria } from "@/lib/webauthn-client";

const inputCls =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-card-foreground placeholder:text-subtitle focus:outline-none focus:ring-2 focus:ring-primary/40";

/**
 * `passkeyEnDispositivo` lo resuelve el servidor (cookie "pista"): el botón de
 * biometría solo aparece en un dispositivo donde ya se activó una passkey. El
 * primer login de un dispositivo es siempre con contraseña.
 */
export default function LoginClient({
  passkeyEnDispositivo,
}: {
  passkeyEnDispositivo: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const verificado = params.get("verificado") === "1";
  const errorParam = params.get("error");
  // `?expirada=1`: la sesión se cerró por INACTIVIDAD (ventana de 1 h del proxy)
  // mientras el usuario tenía una pestaña abierta. Lo manda
  // `SessionExpiredWatcher` cuando una Server Action quedó redirigida a /login.
  const expirada = params.get("expirada") === "1";

  // Último email con el que se entró en ESTE dispositivo (`lib/ultimo-email.ts`).
  // Es el valor del campo hasta que el usuario lo toque: `email === null` significa
  // "todavía no escribió nada" ⇒ se muestra el email guardado. En cuanto escribe
  // (o lo borra) manda lo suyo, incluido un campo vacío. El valor llega vacío en el
  // servidor y en el render de hidratación, y se completa apenas hidrata (ver
  // `useUltimoEmail` en `lib/use-cliente.ts`: sin `setState` en un efecto).
  const ultimoEmail = useUltimoEmail();
  const [email, setEmail] = useState<string | null>(null);
  const emailCampo = email ?? ultimoEmail;
  const [password, setPassword] = useState("");
  /** Campo Contraseña: recibe el foco cuando el email ya viene precargado. */
  const passwordRef = useRef<HTMLInputElement>(null);
  const [recordar, setRecordar] = useState(false);
  const [error, setError] = useState(errorParam === "token-invalido" ? "Token de verificación inválido o expirado" : "");
  const [loading, setLoading] = useState(false);

  // Login con biometría (WebAuthn/passkeys). `webAuthn` = la ceremonia se puede
  // intentar (HTTPS + API); NO se exige que el sistema reporte biometría, porque
  // en iPhone eso da false si el usuario no tiene gestor de llaves configurado y
  // igual la ceremonia funciona.
  const [webAuthn, setWebAuthn] = useState(false);
  const [loadingBiometria, setLoadingBiometria] = useState(false);
  const [errorBiometria, setErrorBiometria] = useState("");

  // ¿Este dispositivo puede usar biometría? (API del navegador: no existe en el
  // servidor). Si no puede, el botón no se muestra y queda el login normal.
  useEffect(() => {
    let cancelado = false;
    void estadoBiometria().then((e) => {
      if (!cancelado) setWebAuthn(e.puedeIntentar);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  // Si el email vino PRECARGADO (hay último login en este dispositivo), el foco
  // arranca directo en la contraseña: el usuario no tiene que tocar el primer
  // campo. El efecto se dispara cuando el valor real aparece (en el servidor y en
  // la hidratación llega vacío) y **no le roba el foco** a lo que el usuario ya
  // haya tocado a mano. `preventScroll` evita un salto de scroll en pantallas
  // bajas (el teclado puede abrirse solo en Android).
  useEffect(() => {
    if (!ultimoEmail) return;
    const activo = document.activeElement;
    if (activo && activo !== document.body) return;
    passwordRef.current?.focus({ preventScroll: true });
  }, [ultimoEmail]);

  async function handleBiometria() {
    setErrorBiometria("");
    setLoadingBiometria(true);
    try {
      const resultado = await entrarConBiometria(recordar);
      if (!resultado.ok) {
        setErrorBiometria(resultado.error ?? "No pudimos validar el acceso");
        return;
      }
      // Misma sesión que el login con contraseña: los mismos flags por pestaña.
      if (recordar) {
        sessionStorage.removeItem(NO_REMEMBER);
        sessionStorage.removeItem(PENDING_CLEAR);
      } else {
        sessionStorage.setItem(NO_REMEMBER, "1");
        sessionStorage.removeItem(PENDING_CLEAR);
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoadingBiometria(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailCampo, password, recordar }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al iniciar sesión");
        return;
      }
      // Login exitoso: se recuerda el email en el dispositivo para precargarlo la
      // próxima vez (solo acá: un intento fallido no se guarda).
      guardarUltimoEmail(emailCampo);
      // Sesión "no recordar": la guardia por pestaña solo actúa si está este flag.
      if (recordar) {
        sessionStorage.removeItem(NO_REMEMBER);
        sessionStorage.removeItem(PENDING_CLEAR);
      } else {
        sessionStorage.setItem(NO_REMEMBER, "1");
        sessionStorage.removeItem(PENDING_CLEAR);
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-[20px] font-semibold text-header">Finanzas</h1>
          <p className="mt-1 text-[13px] text-subtitle">
            Ingresá para ver tus finanzas personales
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          {verificado && (
            <p className="mb-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-[12px] text-success">
              Email verificado. Ya podés iniciar sesión.
            </p>
          )}
          {expirada && (
            <p className="mb-4 rounded-md border border-border bg-muted px-3 py-2 text-[12px] text-subtitle">
              Tu sesión se cerró por inactividad. Volvé a ingresar para seguir
              donde estabas.
            </p>
          )}
          {error && (
            <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
              {error}
            </p>
          )}

          <label className="mb-1.5 block text-[13px] font-medium text-header">
            Email
          </label>
          <input
            type="email"
            value={emailCampo}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="tu@email.com"
            className={inputCls}
          />

          <label className="mb-1.5 mt-4 block text-[13px] font-medium text-header">
            Contraseña
          </label>
          <input
            ref={passwordRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className={inputCls}
          />

          <div className="mt-4">
            <Checkbox
              checked={recordar}
              onChange={setRecordar}
              label="Mantener la sesión iniciada en este dispositivo"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-md bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        {/* Login con biometría (passkeys). Solo se muestra si ESTE dispositivo
            ya tiene una passkey activada (`passkeyEnDispositivo`, que resuelve
            el servidor) y si el equipo ofrece biometría: así el primer login de
            un dispositivo nuevo es siempre con contraseña. */}
        {passkeyEnDispositivo && webAuthn && (
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] text-subtitle">o</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <button
              type="button"
              onClick={handleBiometria}
              disabled={loadingBiometria || loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card py-2.5 text-[13px] font-medium text-card-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Fingerprint className="h-4 w-4" />
              {loadingBiometria ? "Esperando biometría..." : "Entrar con biometría"}
            </button>
            {errorBiometria && (
              <p className="mt-2 text-center text-[11.5px] text-danger">
                {errorBiometria}
              </p>
            )}
          </div>
        )}

        <p className="mt-4 text-center text-[13px] text-subtitle">
          ¿No tenés cuenta?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Registrate
          </Link>
        </p>
      </div>
    </main>
  );
}
