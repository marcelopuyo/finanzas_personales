"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Briefcase,
  ChevronRight,
  Ellipsis,
  HandCoins,
  Home,
  Receipt,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { usePrefetchNav } from "@/components/ui/nav-progress";

/**
 * **Barra inferior de navegación** (2026-10-01, rama `rediseno-ui`) — reemplaza la
 * navegación que hoy vive DENTRO del dashboard (7 paneles apilados en una sola
 * página) por **5 destinos de primer nivel**, cada uno con su pantalla:
 *
 *   Inicio · Gastos · Ingresos · Resultados · Más
 *
 * 🔑 **Alcance**: se muestra **solo en las 5 pantallas principales** (decisión del
 * usuario, 2026-10-01). En wizards, CRUDs y pantallas de detalle manda el `‹` de
 * la cabecera (§210), así no quedan 3 elementos fijos apilados en un celular.
 * Excepción: las sub-pantallas del hub "Más opciones" (ej. Préstamos) son de la
 * **misma jerarquía** ⇒ también la muestran.
 *
 * ⚠️ **Desktop**: por ahora la barra se ve en todos los tamaños (el sidebar de
 * `lg:` quedó parqueado para una segunda fase). Por eso va centrada y con ancho
 * máximo: en pantalla grande se lee como una barra flotante, no como un borde.
 *
 * 🔑 **Estado activo**: `/dashboard` matchea **exacto** (si no, cualquier
 * `/dashboard/*` marcaría también Inicio); el resto matchea **por prefijo**, así
 * `/dashboard/mas/prestamos` deja marcado "Más".
 */
const TABS = [
  { href: "/dashboard", icon: Home, label: "Inicio" },
  { href: "/dashboard/gastos", icon: Receipt, label: "Gastos" },
  { href: "/dashboard/ingresos", icon: Briefcase, label: "Ingresos" },
  { href: "/dashboard/resultados", icon: BarChart3, label: "Resultados" },
] as const;

/**
 * Opciones del 5º botón (**"Más"**).
 *
 * ⚠️ **NO es una pantalla** (decisión del usuario, 2026-10-01): el botón **abre un
 * popup** y desde ahí se dispara la navegación. Sumar una funcionalidad nueva es
 * agregar un ítem acá — sin tocar la barra ni crear un hub.
 *
 * 🔑 Sigue siendo el lugar natural de los CRUD que hoy no tienen punto de entrada
 * (Tarjetas, Períodos y Movimientos de tarjeta, Inflación…).
 */
export const OPCIONES_MAS = [
  { href: "/dashboard/prestamos", label: "Préstamos", icon: HandCoins },
] as const;

/** ¿Está activo este tab para la ruta actual? */
function esActivo(href: string, ruta: string): boolean {
  return href === "/dashboard" ? ruta === "/dashboard" : ruta.startsWith(href);
}

export default function BottomNav() {
  const ruta = usePathname() ?? "";
  const router = useRouter();
  // Prefetch al primer contacto (mismo patrón que el resto de la app): el tab se
  // siente instantáneo cuando el resto viaja en `staleTimes: 30`.
  const prefetch = usePrefetchNav();
  /** Popup del botón "Más" (no navega: es un disparador). */
  const [abierto, setAbierto] = useState(false);
  /** ¿Estamos en alguna de las pantallas que cuelgan de "Más"? */
  const masActivo = OPCIONES_MAS.some((o) => ruta.startsWith(o.href));

  return (
    <>
    <nav
      // `data-barra-nav` lo usan el FAB "+" y el 🎤 para apilarse por encima
      // (misma idea que `data-barra-inferior`, ver `globals.css`).
      data-barra-nav=""
      aria-label="Secciones"
      className="fixed bottom-0 left-0 right-0 z-40 mx-auto flex h-16 max-w-lg items-stretch border-t border-border bg-sidebar"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map((t) => {
        const activo = esActivo(t.href, ruta);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={activo ? "page" : undefined}
            onPointerEnter={() => prefetch(t.href)}
            onTouchStartCapture={() => prefetch(t.href)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
              activo ? "text-primary" : "text-subtitle hover:text-header"
            )}
          >
            <Icon className="h-[21px] w-[21px]" />
            <span className="text-[10px] leading-none">{t.label}</span>
          </Link>
        );
      })}

      {/* 5º botón: **popup**, no pantalla. Queda marcado como activo cuando
          estamos en alguna de sus opciones (ej. /dashboard/prestamos).
          ⚠️ `onClick` plano (no `useTap`): es un botón chico y así responde a
          cualquier click, incluido el del mouse en escritorio. */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
          masActivo ? "text-primary" : "text-subtitle hover:text-header"
        )}
      >
        <Ellipsis className="h-[21px] w-[21px]" />
        <span className="text-[10px] leading-none">Más</span>
      </button>
    </nav>

    <Modal
      open={abierto}
      onClose={() => setAbierto(false)}
      centrado
      title="Más opciones"
    >
      <div className="-mx-1 space-y-1">
        {OPCIONES_MAS.map((o) => {
          const Icon = o.icon;
          return (
            <button
              key={o.href}
              type="button"
              onPointerEnter={() => prefetch(o.href)}
              onTouchStartCapture={() => prefetch(o.href)}
              onClick={() => {
                setAbierto(false);
                router.push(o.href);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted"
            >
              <Icon className="h-4.5 w-4.5 text-subtitle" />
              <span className="flex-1 text-[14px] text-card-foreground">
                {o.label}
              </span>
              <ChevronRight className="h-4 w-4 text-subtitle" />
            </button>
          );
        })}
      </div>
    </Modal>
    </>
  );
}
