"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, LogOut, Moon, ShieldCheck, Sun } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/components/layout/theme-provider";
import { Modal } from "@/components/ui/modal";
import { Combobox } from "@/components/ui/combobox";
import { cambiarPassword, actualizarMonedaPredeterminada } from "@/backend/src/actions/cuenta";
import { NO_REMEMBER, PENDING_CLEAR } from "@/lib/session-flags";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-card-foreground placeholder:text-subtitle focus:outline-none focus:ring-2 focus:ring-primary/40";

/**
 * Página de perfil (estilo DeepSeek): info de la cuenta, tema claro/oscuro,
 * cambio de contraseña, acceso al panel admin (solo admins) y cerrar sesión.
 */
export default function PerfilClient({
  nombre,
  email,
  esAdmin,
  initials,
  monedas,
  monedaPredeterminadaId,
}: {
  nombre: string;
  email: string;
  esAdmin: boolean;
  initials: string;
  monedas: { id: number; nombre: string; codigoISO: string; codigoPais: string | null }[];
  monedaPredeterminadaId: number;
}) {
  const { theme, setTheme } = useTheme();
  const [passOpen, setPassOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [monedaId, setMonedaId] = useState(monedaPredeterminadaId);
  const [savingMoneda, setSavingMoneda] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (next !== confirm) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    setSaving(true);
    try {
      await cambiarPassword({ passwordActual: current, passwordNueva: next });
      toast.success("Contraseña actualizada correctamente");
      setPassOpen(false);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignora: se navega igual */
    } finally {
      // Limpiar los flags de la sesión "no recordar" para que la guardia
      // no restaure la sesión tras el logout explícito.
      sessionStorage.removeItem(NO_REMEMBER);
      sessionStorage.removeItem(PENDING_CLEAR);
      window.location.href = "/login";
    }
  }

  async function handleGuardarMoneda() {
    setSavingMoneda(true);
    try {
      await actualizarMonedaPredeterminada({ monedaId });
      toast.success("Moneda predeterminada actualizada");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingMoneda(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-[18px] font-semibold text-header">Perfil</h1>
      <p className="mt-1 text-[13px] text-subtitle">
        Opciones de tu cuenta
      </p>

      <div className="mt-4 space-y-4">
        {/* Cuenta */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-[14px] font-semibold text-primary-foreground">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium text-header">{nombre}</p>
              <p className="truncate text-[13px] text-subtitle">{email}</p>
              <span
                className={cn(
                  "mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  esAdmin
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-subtitle"
                )}
              >
                <ShieldCheck className="h-3 w-3" />
                {esAdmin ? "Administrador" : "Usuario"}
              </span>
            </div>
          </div>
        </section>

        {/* Tema */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-[14px] font-medium text-header">Tema</h2>
          <div className="mt-3 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[13px] transition-colors",
                theme === "light"
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-card-foreground hover:bg-muted"
              )}
            >
              <Sun className="h-4 w-4" /> Claro
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[13px] transition-colors",
                theme === "dark"
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-card-foreground hover:bg-muted"
              )}
            >
              <Moon className="h-4 w-4" /> Oscuro
            </button>
          </div>
        </section>

        {/* Moneda predeterminada */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-[14px] font-medium text-header">Moneda predeterminada</h2>
          <p className="mt-1 text-[12px] text-subtitle">
            Se usa para mostrar el balance actual y las tarjetas sintéticas del dashboard.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Combobox
              value={monedaId ? String(monedaId) : ""}
              onChange={(v) => setMonedaId(Number(v))}
              options={monedas.map((m) => ({
                value: String(m.id),
                label: `${m.nombre} (${m.codigoISO})`,
                flag: m.codigoPais,
              }))}
              placeholder="Seleccionar moneda..."
              className="w-full"
            />
            <button
              type="button"
              onClick={handleGuardarMoneda}
              disabled={savingMoneda || monedaId === monedaPredeterminadaId}
              className="shrink-0 rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {savingMoneda ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </section>

        {/* Opciones */}
        <section className="rounded-xl border border-border bg-card p-2">
          <button
            type="button"
            onClick={() => setPassOpen(true)}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2.5 text-[13px] text-card-foreground transition-colors hover:bg-muted"
          >
            <KeyRound className="h-4 w-4" /> Cambiar contraseña
          </button>
          {esAdmin && (
            <Link
              href="/admin"
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2.5 text-[13px] text-card-foreground transition-colors hover:bg-muted"
            >
              <ShieldCheck className="h-4 w-4" /> Panel de administración
            </Link>
          )}
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2.5 text-[13px] text-danger transition-colors hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
          </button>
        </section>
      </div>

      {/* Modal: cambio de contraseña */}
      <Modal open={passOpen} onClose={() => setPassOpen(false)} title="Cambiar contraseña">
        <form onSubmit={handleChangePassword} className="space-y-4">
          {error && (
            <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
              {error}
            </p>
          )}

          <div>
            <label htmlFor="pass-actual" className="mb-1.5 block text-[13px] font-medium text-header">
              Contraseña actual
            </label>
            <input
              id="pass-actual"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="pass-nueva" className="mb-1.5 block text-[13px] font-medium text-header">
              Contraseña nueva
            </label>
            <input
              id="pass-nueva"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="pass-confirmar" className="mb-1.5 block text-[13px] font-medium text-header">
              Confirmar contraseña nueva
            </label>
            <input
              id="pass-confirmar"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              className={inputCls}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Actualizar contraseña"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
