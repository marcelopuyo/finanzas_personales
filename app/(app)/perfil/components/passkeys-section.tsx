"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import {
  eliminarCredencialWebauthn,
  renombrarCredencialWebauthn,
} from "@/backend/src/actions/webauthn";
import type { CredencialWebauthnOut } from "@/backend/src/queries/webauthn";
import { dateToLocaleDateString } from "@/lib/utils";
import { activarBiometria, estadoBiometria } from "@/lib/webauthn-client";
import type { EstadoBiometria, MotivoBiometria } from "@/lib/webauthn-client";

/**
 * Texto según el MOTIVO por el que no se puede usar biometría. "No disponible"
 * a secas es engañoso en iPhone (Face ID existe): casi siempre es el contexto,
 * el navegador o la configuración del sistema.
 */
function mensajeDeBiometria(estado: EstadoBiometria | null): string {
  if (!estado) return "Comprobando la biometría de este dispositivo...";

  const sufijo = " Podés seguir entrando con tu contraseña.";
  const mensajes: Record<MotivoBiometria, string> = {
    ok: "",
    "sin-ventana": "Comprobando la biometría de este dispositivo...",
    insegura:
      "La biometría necesita una conexión segura (HTTPS): el navegador la bloquea en páginas HTTP." +
      sufijo,
    "sin-api":
      "Este navegador no expone la API de biometría (pasa en navegadores integrados dentro de otra app)." +
      sufijo,
    "sin-metodo":
      "Este navegador no incluye la comprobación de biometría." + sufijo,
    "sin-respuesta":
      "El navegador no respondió a la comprobación de biometría." + sufijo,
    error: `El navegador rechazó la comprobación de biometría${
      estado.detalle ? ` (${estado.detalle})` : ""
    }.` + sufijo,
    "no-disponible":
      "El sistema no reporta biometría disponible para este sitio (por ejemplo, Face ID/Touch ID sin el llavero de iCloud, o Windows Hello sin configurar)." +
      sufijo,
  };

  return mensajes[estado.motivo];
}

/**
 * Sección "Acceso con biometría" de Perfil: lista las passkeys (una por
 * dispositivo), permite activar la de ESTE dispositivo y revocar/renombrar las
 * demás. La contraseña sigue funcionando siempre como alternativa.
 */
export function PasskeysSection({
  credenciales,
}: {
  credenciales: CredencialWebauthnOut[];
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoBiometria | null>(null);
  const [activando, setActivando] = useState(false);
  const [aRevocar, setARevocar] = useState<CredencialWebauthnOut | null>(null);
  const [aRenombrar, setARenombrar] = useState<CredencialWebauthnOut | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);

  // ¿Este dispositivo puede usar biometría? (se consulta al montar: es una API
  // del navegador, no existe en el servidor).
  useEffect(() => {
    let cancelado = false;
    void estadoBiometria().then((e) => {
      if (!cancelado) setEstado(e);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  async function handleActivar() {
    setActivando(true);
    try {
      const resultado = await activarBiometria();
      if (resultado.ok) {
        toast.success("Listo: este dispositivo ya puede entrar con biometría");
        router.refresh();
      } else {
        toast.error(resultado.error ?? "No se pudo activar la biometría");
      }
    } finally {
      setActivando(false);
    }
  }

  async function handleRevocar() {
    if (!aRevocar) return;
    setGuardando(true);
    try {
      await eliminarCredencialWebauthn(aRevocar.id);
      toast.success("Acceso revocado para ese dispositivo");
      setARevocar(null);
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function handleRenombrar() {
    if (!aRenombrar) return;
    setGuardando(true);
    try {
      await renombrarCredencialWebauthn(aRenombrar.id, nombreNuevo);
      toast.success("Nombre actualizado");
      setARenombrar(null);
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-subtitle" />
          <h2 className="text-[14px] font-medium text-header">
            Acceso con biometría
          </h2>
        </div>
        <p className="mt-1 text-[12px] text-subtitle">
          Entrá a la app con la huella, el rostro o el PIN del dispositivo, sin
          escribir la contraseña. La contraseña sigue funcionando siempre.
        </p>

        {/* Credenciales registradas */}
        {credenciales.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {credenciales.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-card-foreground">
                    {c.nombre ?? "Dispositivo"}
                  </p>
                  <p className="text-[11px] text-subtitle">
                    {c.deviceType === "multiDevice"
                      ? "Passkey sincronizada"
                      : "Solo este dispositivo"}{" "}
                    · agregada el {dateToLocaleDateString(c.creadoEn)}
                    {c.ultimoUsoEn
                      ? ` · último uso ${dateToLocaleDateString(c.ultimoUsoEn)}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Renombrar"
                  title="Renombrar"
                  onClick={() => {
                    setNombreNuevo(c.nombre ?? "");
                    setARenombrar(c);
                  }}
                  className="rounded-md p-1.5 text-subtitle transition-colors hover:bg-muted hover:text-header"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Revocar acceso"
                  title="Revocar acceso"
                  onClick={() => setARevocar(c)}
                  className="rounded-md p-1.5 text-danger transition-colors hover:bg-muted"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-lg border border-border px-3 py-2 text-[12px] text-subtitle">
            Todavía no activaste ningún dispositivo.
          </p>
        )}

        {/* Alta de ESTE dispositivo. El botón se muestra si la ceremonia se
            PUEDE intentar (HTTPS + API): que el sistema no reporte biometría
            configurada no lo bloquea, porque el navegador puede ofrecer
            administrar las llaves de acceso igual. */}
        <div className="mt-3">
          {estado?.puedeIntentar ? (
            <>
              <button
                type="button"
                onClick={handleActivar}
                disabled={activando}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Fingerprint className="h-4 w-4" />
                {activando ? "Activando..." : "Activar en este dispositivo"}
              </button>
              {!estado.soportado && (
                <p className="mt-2 text-[11px] text-subtitle">
                  El sistema no reporta biometría configurada para este sitio
                  (suele ser el llavero de iCloud o el gestor de llaves de acceso
                  apagado). Probá igual: si el navegador te ofrece{" "}
                  <b>administrar tus llaves de acceso</b>, aceptá y volvé a
                  intentar.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-[11px] text-subtitle">
                {mensajeDeBiometria(estado)}
              </p>
              {/* Diagnóstico: sirve para reportar fallas en dispositivos donde la
                  comprobación da "no disponible" (iPhone, WebView, etc.). */}
              {estado && estado.motivo !== "sin-ventana" && (
                <p className="mt-2 rounded-md bg-muted px-2 py-1.5 text-[10px] leading-4 break-all text-subtitle">
                  {estado.diagnostico}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {/* Confirmación de revocación */}
      <Modal
        open={aRevocar !== null}
        onClose={() => setARevocar(null)}
        title="Revocar acceso con biometría"
      >
        <p className="text-[13px] text-card-foreground">
          ¿Querés revocar la passkey{" "}
          <b>{aRevocar?.nombre ?? "Dispositivo"}</b>? Ese dispositivo va a tener
          que volver a activar la biometría (y podés seguir entrando con tu
          contraseña).
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setARevocar(null)}
            className="rounded-md px-3 py-2 text-[13px] text-card-foreground transition-colors hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleRevocar}
            disabled={guardando}
            className="rounded-md bg-danger px-3 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? "Revocando..." : "Revocar"}
          </button>
        </div>
      </Modal>

      {/* Renombrar */}
      <Modal
        open={aRenombrar !== null}
        onClose={() => setARenombrar(null)}
        title="Renombrar passkey"
      >
        <label className="mb-1.5 block text-[13px] font-medium text-header">
          Nombre del dispositivo
        </label>
        <input
          type="text"
          value={nombreNuevo}
          onChange={(e) => setNombreNuevo(e.target.value)}
          maxLength={80}
          placeholder="Ej: iPhone de Marcelo"
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-card-foreground placeholder:text-subtitle focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setARenombrar(null)}
            className="rounded-md px-3 py-2 text-[13px] text-card-foreground transition-colors hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleRenombrar}
            disabled={guardando || !nombreNuevo.trim()}
            className="rounded-md bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </Modal>
    </>
  );
}
