"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Fingerprint, Lock, Mail } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import Logo from "@/components/layout/logo";
import { NO_REMEMBER, PENDING_CLEAR } from "@/lib/session-flags";
import { guardarUltimoEmail } from "@/lib/ultimo-email";
import { useUltimoEmail } from "@/lib/use-cliente";
import { entrarConBiometria, estadoBiometria } from "@/lib/webauthn-client";

/** Contenedor del campo: el icono y el input comparten el recuadro y el foco. */
const fieldBoxCls =
  "flex h-[50px] items-center gap-2.5 rounded-[14px] border border-[#ffffff14] bg-[#ffffff08] px-3.5 transition focus-within:border-[#c5ef5580] focus-within:bg-[#c5ef550f] focus-within:ring-2 focus-within:ring-[#c5ef5514]";

const inputCls =
  "min-w-0 flex-1 bg-transparent text-[16px] text-[#f2f5f3] placeholder:text-[#6f817d] outline-none";

/** Acción secundaria (biometría): contorno suave, sin competir con el CTA lima.
 *  `shrink-0`: la sección del login es un flex column con scroll y, sin esto, el
 *  botón se comprimía hasta el alto del texto en pantallas bajas. */
const ghostCls =
  "flex h-[52px] w-full shrink-0 items-center justify-center gap-2.5 rounded-[14px] border border-[#ffffff1c] bg-[#ffffff08] px-4 text-[14px] font-semibold text-[#eef3f0] transition-colors hover:bg-[#ffffff12] disabled:cursor-wait disabled:opacity-55";

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
  /** Ojo del campo Contraseña: alterna texto/oculto sin perder el valor. */
  const [verPassword, setVerPassword] = useState(false);

  useEffect(() => {
    const metas = Array.from(
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    );
    const coloresAnteriores = metas.map((meta) => meta.content);
    let metaAgregada: HTMLMetaElement | null = null;

    if (metas.length === 0) {
      metaAgregada = document.createElement("meta");
      metaAgregada.name = "theme-color";
      document.head.append(metaAgregada);
      metas.push(metaAgregada);
    }

    for (const meta of metas) meta.content = "#10171b";

    return () => {
      metas.forEach((meta, index) => {
        if (meta === metaAgregada) {
          meta.remove();
        } else {
          meta.content = coloresAnteriores[index];
        }
      });
    };
  }, []);

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
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-[#0d1317]"
        style={{
          bottom: "calc(-1 * env(safe-area-inset-bottom))",
          backgroundColor: "#10171b",
          backgroundImage:
            "radial-gradient(ellipse at 50% 0%, #1d302b 0, transparent 58%)",
        }}
      />
      <main
        data-login-screen
        className="dark relative z-10 h-dvh overflow-hidden px-5 text-[#f2f5f3]"
        style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}
      >
        <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[430px] flex-col">
          <header
            className="flex shrink-0 justify-start"
            style={{
              // `max()` en vez de sumar: en iPhone la safe area (~59px) ya deja
              // aire suficiente; sumarle los 58px fijos empujaba el logo al
              // medio de la pantalla y comía el alto que necesita el resto.
              paddingTop:
                "max(calc(env(safe-area-inset-top) + 18px), clamp(24px, 6dvh, 56px))",
            }}
          >
            <Logo size={22} />
          </header>

          {/* Scroll propio + `shrink-0` en los hijos: en pantallas bajas el
              contenido se desplaza en vez de aplastarse (el botón de biometría
              quedaba con el alto del texto). El footer se ancla con `mt-auto`.
              Los espaciados usan `dvh` porque `vh` en el móvil cuenta el alto
              con la barra del navegador oculta: el ritmo se veía mucho más
              apretado que en el escritorio. */}
          <section className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto pb-[clamp(12px,2dvh,24px)]">
            <h1 className="mt-[clamp(20px,5.5dvh,52px)] shrink-0 text-[clamp(24px,6.8vw,30px)] font-medium leading-[1.1] tracking-[-0.03em]">
              Bienvenido
            </h1>
            <p className="mt-2 shrink-0 text-[14px] leading-relaxed text-[#93a3a0]">
              Ingresá a la aplicación
            </p>

            {verificado && (
              <p className="mt-5 shrink-0 rounded-xl border border-[#51cf6640] bg-[#51cf6618] px-3.5 py-3 text-[13px] text-[#a7e5ae]">
                Email verificado. Ya podés iniciar sesión.
              </p>
            )}
            {expirada && (
              <p className="mt-5 shrink-0 rounded-xl border border-[#ffffff1a] bg-[#ffffff08] px-3.5 py-3 text-[13px] text-[#c2ceca]">
                Tu sesión se cerró por inactividad. Volvé a ingresar para seguir
                donde estabas.
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="mt-5 shrink-0 rounded-xl border border-[#ff6b6b50] bg-[#ff6b6b18] px-3.5 py-3 text-[13px] text-[#ff9b9b]"
              >
                {error}
              </p>
            )}

            <form onSubmit={onSubmit} className="mt-[clamp(16px,2.4dvh,24px)] shrink-0">
              <label
                htmlFor="login-email"
                className="mb-2 block text-[12.5px] font-semibold text-[#cbd5d1]"
              >
                Email
              </label>
              <div className={fieldBoxCls}>
                <Mail
                  className="h-[17px] w-[17px] shrink-0 text-[#7b8d89]"
                  aria-hidden="true"
                />
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
              </div>

              <div className="mt-[clamp(12px,1.8dvh,16px)] flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="text-[12.5px] font-semibold text-[#cbd5d1]"
                >
                  Contraseña
                </label>
                <Link
                  href="/recuperar"
                  className="text-[12px] font-medium text-[#a9b6b2] transition-colors hover:text-[#c5ef55] hover:underline"
                >
                  ¿Olvidaste?
                </Link>
              </div>
              <div className={`${fieldBoxCls} mt-2`}>
                <Lock
                  className="h-[17px] w-[17px] shrink-0 text-[#7b8d89]"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  ref={passwordRef}
                  type={verPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={
                    verPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-pressed={verPassword}
                  className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-[7px] text-[#7b8d89] transition-colors hover:bg-[#ffffff0d] hover:text-[#c3cfcb]"
                >
                  {verPassword ? (
                    <EyeOff className="h-[17px] w-[17px]" aria-hidden="true" />
                  ) : (
                    <Eye className="h-[17px] w-[17px]" aria-hidden="true" />
                  )}
                </button>
              </div>

              <div className="mt-[clamp(12px,1.8dvh,16px)]">
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
                className="mt-[clamp(14px,2dvh,20px)] h-[52px] w-full rounded-[14px] bg-[#c5ef55] text-[15px] font-bold text-[#17210a] shadow-[0_12px_32px_#c5ef5529] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-55"
              >
                {loading ? "Ingresando..." : "Iniciar sesión"}
              </button>
            </form>

            {webAuthn && (
              <>
                <div className="my-[clamp(10px,1.6dvh,16px)] flex shrink-0 items-center gap-3 text-[11px] text-[#71817d]">
                  <span className="h-px flex-1 bg-[#26343a]" />
                  <span>o</span>
                  <span className="h-px flex-1 bg-[#26343a]" />
                </div>
                <button
                  type="button"
                  onClick={handleBiometria}
                  disabled={loadingBiometria || loading}
                  className={ghostCls}
                >
                  <Fingerprint
                    className="h-[18px] w-[18px] shrink-0 text-[#c5ef55]"
                    aria-hidden="true"
                  />
                  {loadingBiometria
                    ? "Esperando biometría..."
                    : "Ingresar con biometría"}
                </button>
                {errorBiometria && (
                  <p
                    role="alert"
                    className="mt-2 shrink-0 text-center text-[12px] text-[#ff9b9b]"
                  >
                    {errorBiometria}
                  </p>
                )}
              </>
            )}

            <footer
              className="mt-auto shrink-0 pt-[clamp(14px,2.4dvh,28px)] text-center text-[13px] text-[#8d9c98]"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              ¿No tenés cuenta?{" "}
              <Link
                href="/register"
                className="font-semibold text-[#c5ef55] hover:underline"
              >
                Registrate
              </Link>
            </footer>
          </section>
        </div>
      </main>
    </>
  );
}
