"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Fingerprint, Mail } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import Logo from "@/components/layout/logo";
import { NO_REMEMBER, PENDING_CLEAR } from "@/lib/session-flags";
import { guardarUltimoEmail } from "@/lib/ultimo-email";
import { useUltimoEmail } from "@/lib/use-cliente";
import { entrarConBiometria, estadoBiometria } from "@/lib/webauthn-client";

const inputCls =
  "w-full rounded-xl border border-[#35434a] bg-[#141d22] px-3.5 py-3 text-[14px] text-[#f2f5f3] placeholder:text-[#71817f] outline-none transition focus:border-[#c5ef5580] focus:ring-2 focus:ring-[#c5ef5520]";

const actionCls =
  "flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-[14px] border border-[#c5ef5550] bg-[#c5ef5517] px-4 text-[14px] font-semibold text-[#f2f5f3] shadow-[inset_0_1px_#ffffff12] backdrop-blur transition-colors hover:bg-[#c5ef5528] disabled:cursor-wait disabled:opacity-55";

/**
 * El botón de biometría se muestra siempre que la ceremonia se pueda intentar
 * (HTTPS + API de WebAuthn). **No** se exige la cookie "pista" del servidor: era
 * un atajo que dejaba sin botón a un equipo que SÍ tiene una passkey (pista
 * perdida, credencial borrada en la base, otro origen…) y en iPhone el botón
 * explícito es imprescindible, porque la biometría **no puede** arrancar sola
 * (Safari exige un gesto). La pista sigue sirviendo, pero del lado del servidor:
 * en `login/options` decide si se manda `allowCredentials` o se cae al flujo
 * descubrible.
 */
export default function LoginClient({
  tienePasskey,
}: {
  tienePasskey: boolean;
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
  const [webAuthn, setWebAuthn] = useState(tienePasskey);
  const [loadingBiometria, setLoadingBiometria] = useState(false);
  const [errorBiometria, setErrorBiometria] = useState("");
  const [modoIngreso, setModoIngreso] = useState<"opciones" | "credenciales">(
    tienePasskey ? "opciones" : "credenciales"
  );

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
  }, [ultimoEmail, modoIngreso]);

  const mostrarOpciones =
    tienePasskey && webAuthn && modoIngreso === "opciones";

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
    <main
      className="dark relative min-h-dvh overflow-y-auto bg-[#0b1014] px-5 text-[#f2f5f3]"
      style={{
        fontFamily: "var(--font-inter), Inter, sans-serif",
        background:
          "radial-gradient(ellipse at 50% 0%, #1d302b 0, transparent 54%), linear-gradient(160deg, #10171b, #0d1317 76%)",
      }}
    >
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
        <header
          className="flex justify-center"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 62px)" }}
        >
          <Logo size={28} />
        </header>

        <section className="my-auto w-full py-14">
          <div className="mb-7 text-center">
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.04em]">
              Bienvenido de nuevo
            </h1>
            <p className="mx-auto mt-2 max-w-[290px] text-[14px] leading-relaxed text-[#99aaa9]">
              Elegí cómo querés ingresar.
            </p>
          </div>

          {verificado && (
            <p className="mb-4 rounded-xl border border-[#51cf6640] bg-[#51cf6618] px-3.5 py-3 text-[13px] text-[#a7e5ae]">
              Email verificado. Ya podés iniciar sesión.
            </p>
          )}
          {expirada && (
            <p className="mb-4 rounded-xl border border-[#ffffff1a] bg-[#ffffff08] px-3.5 py-3 text-[13px] text-[#c2ceca]">
              Tu sesión se cerró por inactividad. Volvé a ingresar para seguir
              donde estabas.
            </p>
          )}
          {error && (
            <p className="mb-4 rounded-xl border border-[#ff6b6b50] bg-[#ff6b6b18] px-3.5 py-3 text-[13px] text-[#ff9b9b]">
              {error}
            </p>
          )}

          {mostrarOpciones ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleBiometria}
                disabled={loadingBiometria || loading}
                className={actionCls}
              >
                <Fingerprint className="h-5 w-5 shrink-0" aria-hidden="true" />
                {loadingBiometria
                  ? "Esperando biometría..."
                  : "Ingresar con biometría"}
              </button>

              <div className="flex items-center gap-3 py-1 text-[12px] text-[#73827f]">
                <span className="h-px flex-1 bg-[#27353c]" />
                <span>o</span>
                <span className="h-px flex-1 bg-[#27353c]" />
              </div>

              <button
                type="button"
                onClick={() => {
                  setErrorBiometria("");
                  setModoIngreso("credenciales");
                }}
                className={actionCls}
              >
                <Mail className="h-5 w-5 shrink-0" aria-hidden="true" />
                Ingresar con email y contraseña
              </button>

              <div className="pt-2">
                <Checkbox
                  checked={recordar}
                  onChange={setRecordar}
                  label="Mantener la sesión iniciada en este dispositivo"
                  className="[&>span]:!text-[#c2ceca]"
                />
              </div>
              {errorBiometria && (
                <p role="alert" className="text-center text-[12px] text-[#ff9b9b]">
                  {errorBiometria}
                </p>
              )}
            </div>
          ) : (
            <>
              {tienePasskey && webAuthn && (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setModoIngreso("opciones");
                  }}
                  className="mb-4 flex items-center gap-2 px-1 py-1 text-[13px] font-medium text-[#c5ef55] hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Volver a las opciones
                </button>
              )}

              <form
                onSubmit={onSubmit}
                className="rounded-2xl border border-[#ffffff14] bg-[#11191f] p-5 shadow-[0_24px_70px_#0005,inset_0_1px_#ffffff08]"
              >
                <label
                  htmlFor="login-email"
                  className="mb-1.5 block text-[13px] font-medium text-[#e3e9e6]"
                >
                  Email
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={emailCampo}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="tu@email.com"
                  className={inputCls}
                />

                <label
                  htmlFor="login-password"
                  className="mb-1.5 mt-4 block text-[13px] font-medium text-[#e3e9e6]"
                >
                  Contraseña
                </label>
                <input
                  id="login-password"
                  ref={passwordRef}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={inputCls}
                />

                <div className="mt-4">
                  <Checkbox
                    checked={recordar}
                    onChange={setRecordar}
                    label="Mantener la sesión iniciada en este dispositivo"
                    className="[&>span]:!text-[#c2ceca]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 w-full rounded-xl bg-[#c5ef55] py-3 text-[14px] font-bold text-[#17210a] shadow-[0_8px_28px_#c5ef5526] transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "Ingresando..." : "Iniciar sesión"}
                </button>
              </form>

              {webAuthn && !tienePasskey && (
                <div className="mt-4">
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-[#27353c]" />
                    <span className="text-[12px] text-[#73827f]">o</span>
                    <span className="h-px flex-1 bg-[#27353c]" />
                  </div>
                  <button
                    type="button"
                    onClick={handleBiometria}
                    disabled={loadingBiometria || loading}
                    className={`${actionCls} mt-4`}
                  >
                    <Fingerprint className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {loadingBiometria
                      ? "Esperando biometría..."
                      : "Ingresar con biometría"}
                  </button>
                  {errorBiometria && (
                    <p role="alert" className="mt-2 text-center text-[12px] text-[#ff9b9b]">
                      {errorBiometria}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        <p className="pb-8 text-center text-[13px] text-[#99aaa9]">
          ¿No tenés cuenta?{" "}
          <Link
            href="/register"
            className="font-semibold text-[#c5ef55] hover:underline"
          >
            Registrate
          </Link>
        </p>
      </div>
    </main>
  );
}
