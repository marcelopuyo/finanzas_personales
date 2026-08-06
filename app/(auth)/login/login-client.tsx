"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const inputCls =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-card-foreground placeholder:text-subtitle focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const verificado = params.get("verificado") === "1";
  const errorParam = params.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(errorParam === "token-invalido" ? "Token de verificación inválido o expirado" : "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al iniciar sesión");
        return;
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
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className={inputCls}
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-md bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

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
