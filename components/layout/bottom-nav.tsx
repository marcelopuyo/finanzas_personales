"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// 🎨 **Set de iconos de la barra: Solar** (decisión del usuario, 2026-10-02).
// Se importan por **estilo** (`/linear` y `/bold-duotone`): cada estilo es un
// módulo ESM con un componente por icono ⇒ el bundle sólo lleva los 8 que se
// usan (el paquete declara `sideEffects: false`).
// ⚠️ Los iconos son de **480 Design (CC BY 4.0)**: el paquete es MIT, pero
// **CC BY exige atribución** ⇒ falta publicar la línea de créditos (ofrecido al
// usuario: al pie de `Perfil`, junto a la versión, o en el README).
import {
  AltArrowRightIcon,
  BillListIcon as BillListLinear,
  HamburgerMenuIcon as HamburgerMenuLinear,
  HandMoneyIcon,
  HomeIcon as HomeLinear,
  MoneyBagIcon as MoneyBagLinear,
} from "@solar-icons/react/linear";
import {
  BillListIcon as BillListDuotone,
  HamburgerMenuIcon as HamburgerMenuDuotone,
  HomeIcon as HomeDuotone,
  MoneyBagIcon as MoneyBagDuotone,
} from "@solar-icons/react/bold-duotone";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { usePrefetchNav } from "@/components/ui/nav-progress";

/**
 * **Barra inferior de navegación** (2026-10-01, rama `rediseno-ui`) — reemplaza la
 * navegación que hoy vive DENTRO del dashboard (7 paneles apilados en una sola
 * página) por **4 destinos de primer nivel**, cada uno con su pantalla:
 *
 *   Inicio · Gastos · Ingresos · Más
 *
 * ⚠️ **El tab "Resultados" se quitó el 2026-10-02** (pedido del usuario): el
 * resumen de Inicio ya muestra el gráfico de **Resultados** y el listado mes a mes
 * (`resultados-mensuales.tsx`) ⇒ entrar a otra pantalla para ver lo mismo dejó de
 * tener sentido. La ruta `/dashboard/resultados` **sigue viva** (la usa la voz
 * "mostrame los resultados"), pero ya no tiene punto de entrada en la barra.
 *
 * 🔑 **Alcance**: se muestra **solo en las pantallas principales** (decisión del
 * usuario, 2026-10-01): los 3 tabs de arriba y las sub-pantallas del hub "Más
 * opciones" (ej. Préstamos). En wizards, CRUDs y pantallas de detalle manda el `‹`
 * de la cabecera (§210), así no quedan 3 elementos fijos apilados en un celular.
 *
 * ⚠️ **Desktop**: por ahora la barra se ve en todos los tamaños (el sidebar de
 * `lg:` quedó parqueado para una segunda fase). Por eso va centrada y con ancho
 * máximo: en pantalla grande se lee como una barra flotante, no como un borde.
 *
 * 🔑 **Estado activo**: `/dashboard` matchea **exacto** (si no, cualquier
 * `/dashboard/*` marcaría también Inicio); el resto matchea **por prefijo**, así
 * `/dashboard/mas/prestamos` deja marcado "Más".
 *
 * 🔑 **Color del activo (2026-10-02)**: **blanco** (`text-header`), no el azul
 * `--primary`: la barra sigue la **paleta monocroma** de la interfaz (pedido del
 * usuario) ⇒ el activo se distingue por **luminosidad** contra el `--subtitle`
 * (`#808185`) de los inactivos. El hover de los inactivos usa `--label`
 * (`#9a9b9e`), un escalón intermedio, para no confundirse con el activo.
 *
 * 🎨 **Set de iconos (2026-10-02)**: **Solar** (480 Design). El tab se dibuja con
 * **dos variantes del MISMO icono**: `linear` cuando está inactivo y
 * **`bold-duotone`** cuando está activo (así el estado activo se distingue por
 * **forma + relleno**, no sólo por color: el duotone pinta la capa secundaria al
 * 50% de opacidad ⇒ blanco pleno el trazo principal y gris el relleno).
 * ⚠️ **Ingresos** usa `money-bag` (bolsa de dinero): el set **no tiene** iconos de
 * monedas/billetes apilados y ésta es la variante “dinero” más legible a 21px.
 * ⚠️ El resto de la app sigue con **lucide**: acá sólo se cambió la barra.
 */
const TABS = [
  {
    href: "/dashboard",
    label: "Inicio",
    icono: HomeLinear,
    iconoActivo: HomeDuotone,
  },
  {
    href: "/dashboard/gastos",
    label: "Gastos",
    icono: BillListLinear,
    iconoActivo: BillListDuotone,
  },
  {
    href: "/dashboard/ingresos",
    label: "Ingresos",
    icono: MoneyBagLinear,
    iconoActivo: MoneyBagDuotone,
  },
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
  { href: "/dashboard/prestamos", label: "Préstamos", icono: HandMoneyIcon },
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
      // ⚠️ Posición y alto (2026-10-03, reportado en un **iPhone Pro Max**, en el
      // Pro se veía perfecto con el mismo build):
      // · `height` = banda de contenido (3.5rem) + safe-area **topado** en 2.5rem:
      //   el alto del viewport de iOS en algunos modelos/versiones no llega hasta
      //   el borde físico de la pantalla y un inset enorme estiraba la barra.
      // · `paddingBottom` = inset **entre 0.5 y 1.75rem**: mantiene el contenido a
      //   una distancia fija (~28px) del borde inferior en TODOS los dispositivos
      //   (sin tope, con un inset grande se iba al medio de la barra).
      className="fixed bottom-0 left-0 right-0 z-40 mx-auto flex max-w-lg items-stretch border-t border-border bg-sidebar"
      style={{
        height: "calc(3.5rem + min(env(safe-area-inset-bottom), 2.5rem))",
        paddingBottom: "clamp(0.75rem, env(safe-area-inset-bottom), 1.75rem)",
      }}
    >
      {/* Faldón: pinta el fondo de la barra **por debajo** de ella. Si el viewport
          de iOS termina antes que la pantalla (el caso del Pro Max), la franja que
          queda debajo muestra el fondo de la barra y no el de la página ⇒ la barra
          se ve pegada al borde. Si no hay franja, queda fuera de pantalla. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 right-0 top-full h-40 bg-sidebar"
      />
      {TABS.map((t) => {
        const activo = esActivo(t.href, ruta);
        const Icono = activo ? t.iconoActivo : t.icono;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={activo ? "page" : undefined}
            onPointerEnter={() => prefetch(t.href)}
            onTouchStartCapture={() => prefetch(t.href)}
            className={cn(
              // `justify-end`: el contenido se apoya arriba del padding del
              // safe-area ⇒ queda siempre a la misma distancia del borde inferior.
              "flex flex-1 flex-col items-center justify-end gap-1 transition-colors",
              activo ? "text-header" : "text-subtitle hover:text-label"
            )}
          >
            <Icono size={21} />
            <span className="text-[10px] leading-none">{t.label}</span>
          </Link>
        );
      })}

      {/* Último botón (4º desde que se quitó "Resultados"): **popup**, no pantalla.
          Queda marcado como activo cuando estamos en alguna de sus opciones
          (ej. /dashboard/prestamos).
          🔑 El icono es **3 líneas apiladas (hamburguesa)** y no el ⋯ elíptico
          horizontal (decisión del usuario, 2026-10-02): se lee como "menú de
          opciones" en el mismo lenguaje que el ⋯ de los encabezados de panel.
          ⚠️ `onClick` plano (no `useTap`): es un botón chico y así responde a
          cualquier click, incluido el del mouse en escritorio. */}
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className={cn(
          "flex flex-1 flex-col items-center justify-end gap-1 transition-colors",
          masActivo ? "text-header" : "text-subtitle hover:text-label"
        )}
      >
        {masActivo ? <HamburgerMenuDuotone size={21} /> : <HamburgerMenuLinear size={21} />}
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
          const Icono = o.icono;
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
              <Icono size={18} />
              <span className="flex-1 text-[14px] text-card-foreground">
                {o.label}
              </span>
              <AltArrowRightIcon size={16} className="text-subtitle" />
            </button>
          );
        })}
      </div>
    </Modal>
    </>
  );
}
