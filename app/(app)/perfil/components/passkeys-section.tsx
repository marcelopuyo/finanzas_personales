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
import { activarBiometria, biometriaDisponible } from "@/lib/webauthn-client";

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
  const [disponible, setDisponible] = useState(false);
  const [activando, setActivando] = useState(false);
  const [aRevocar, setARevocar] = useState<CredencialWebauthnOut | null>(null);
  const [aRenombrar, setARenombrar] = useState<CredencialWebauthnOut | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);

  // ¿Este dispositivo puede usar biometría? (se consulta al montar: es una API
  // del navegador, no existe en el servidor).
  useEffect(() => {
    let cancelado = false;
    void biometriaDisponible().then((ok) => {
      if (!cancelado) setDisponible(ok);
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

        {/* Alta de ESTE dispositivo */}
        <div className="mt-3">
          {disponible ? (
            <button
              type="button"
              onClick={handleActivar}
              disabled={activando}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Fingerprint className="h-4 w-4" />
              {activando ? "Activando..." : "Activar en este dispositivo"}
            </button>
          ) : (
            <p className="text-[11px] text-subtitle">
              Este dispositivo no tiene biometría disponible (o el navegador no
              la soporta). Podés seguir entrando con tu contraseña.
            </p>
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
