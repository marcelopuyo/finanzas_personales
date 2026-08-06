"use client";

import { useState } from "react";
import Link from "next/link";

const inputCls =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-card-foreground placeholder:text-subtitle focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function RegisterClient() {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, nombre: nombre || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al registrarse");
        return;
      }
      // En dev el backend devuelve la URL de verificación (no hay servicio de email).
      if (data.devVerifyUrl) {
        setDevVerifyUrl(data.devVerifyUrl);
      }
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
          <h1 className="text-[20px] font-semibold text-header">Crear cuenta</h1>
          <p className="mt-1 text-[13px] text-subtitle">
            Registrate para empezar a gestionar tus finanzas
          </p>
        </div>

        {devVerifyUrl ? (
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-[13px] text-header">
              Cuenta creada. Verificá tu email para habilitarla.
            </p>
            <p className="mt-2 text-[12px] text-subtitle">
              (En desarrollo no hay servicio de email: usá el enlace de abajo)
            </p>
            <a
              href={devVerifyUrl}
              className="mt-4 block w-full rounded-md bg-primary py-2.5 text-center text-[13px] font-semibold text-primary-foreground hover:opacity-90"
            >
              Verificar email (dev)
            </a>
            <p className="mt-3 text-center text-[12px] text-subtitle">
              Ya verificaste?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Iniciar sesión
              </Link>
            </p>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="rounded-xl border border-border bg-card p-5 shadow-sm"
          >
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
              className={inputCls}
            />

            <label className="mb-1.5 mt-4 block text-[13px] font-medium text-header">
              Nombre (opcional)
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
              className={inputCls}
            />

            <label className="mb-1.5 mt-4 block text-[13px] font-medium text-header">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              className={inputCls}
            />

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-md bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-[13px] text-subtitle">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
