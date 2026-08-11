"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Tabs del panel admin (accesos a los CRUDs administrados).
const TABS = [
  { label: "Usuarios", href: "/admin/usuarios" },
  { label: "Conceptos", href: "/admin/conceptos" },
  { label: "Monedas", href: "/admin/monedas" },
  { label: "Tipos de Cuenta", href: "/admin/tipos-cuenta" },
  { label: "Cotizaciones", href: "/admin/cotizaciones" },
];

/**
 * Shell del panel de administración: barra superior con la marca, las tabs de
 * acceso a los CRUDs y el avatar con las opciones del usuario (derecha). El
 * contenido de los CRUDs se renderiza debajo, con el mismo diseño que el resto
 * de la aplicación.
 */
export default function AdminShell({
  nombre,
  email,
  children,
}: {
  nombre: string;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cierra el dropdown al hacer clic fuera.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignora: se navega igual */
    } finally {
      window.location.href = "/login";
    }
  }

  const initials = (nombre || email || "A")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-sidebar">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          {/* Marca */}
          <Link href="/admin" className="flex shrink-0 items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="hidden text-[14px] font-semibold text-sidebar-foreground sm:inline">
              Finanzas
            </span>
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-medium text-primary">
              Admin
            </span>
          </Link>

          {/* Tabs de acceso a los CRUDs */}
          <nav className="ml-1 flex flex-1 items-center gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const active = pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] transition-colors",
                    active
                      ? "bg-primary font-medium text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-hover"
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          {/* Avatar + opciones del usuario */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-sidebar-hover"
              aria-label="Opciones de usuario"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[12px] font-semibold text-primary-foreground">
                {initials}
              </span>
              <span className="hidden text-left md:block">
                <span className="block max-w-[140px] truncate text-[13px] font-medium leading-4 text-sidebar-foreground">
                  {nombre}
                </span>
                <span className="block text-[11px] leading-4 text-sidebar-muted">
                  Administrador
                </span>
              </span>
              <ChevronDown className="h-4 w-4 text-sidebar-muted" />
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                <div className="border-b border-border px-3 py-2">
                  <p className="truncate text-[13px] font-medium text-header">{nombre}</p>
                  <p className="truncate text-[12px] text-subtitle">{email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push("/dashboard");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-card-foreground transition-colors hover:bg-muted"
                >
                  <LayoutDashboard className="h-4 w-4" /> Ver aplicación
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-danger transition-colors hover:bg-muted"
                >
                  <LogOut className="h-4 w-4" />
                  {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 lg:p-6">{children}</main>
    </div>
  );
}
