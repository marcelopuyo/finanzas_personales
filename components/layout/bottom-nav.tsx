"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// 🎨 **Set de iconos de la barra: Solar** (decisión del usuario, 2026-10-02).
// Se importan por **estilo** (`/linear` y `/bold-duotone`): cada estilo es un
// módulo ESM con un componente por icono ⇒ el bundle sólo lleva los 8 que se
// usan (el paquete declara `sideEffects: false`).
// ⚠️ Los iconos son de **480 Design (CC BY 4.0)**: el paquete es MIT, pero
// **CC BY exige atribución** ⇒ se publica en el popup **Créditos** del Perfil
// (`app/(app)/perfil/components/creditos.tsx`, 2026-10-07). Si se cambia este set,
// hay que actualizar esa lista.
import {
  AltArrowRightIcon,
  BillListIcon as BillListLinear,
  GraphUpIcon as GraphUpLinear,
  HamburgerMenuIcon as HamburgerMenuLinear,
  HandMoneyIcon,
  HomeIcon as HomeLinear,
  MoneyBagIcon as MoneyBagLinear,
} from "@solar-icons/react/linear";
import {
  BillListIcon as BillListDuotone,
  GraphUpIcon as GraphUpDuotone,
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
 * página) por **destinos de primer nivel**, cada uno con su pantalla:
 *
 *   Inicio · Gastos · Ingresos · Resultados · Más
 *
 * 🔑 **"Resultados" volvió el 2026-10-03** (había salido el 2026-10-02): con el
 * cambio de la tarjeta *Balance Actual* (que pasó a mostrar el **aporte por
 * cuenta**), el gráfico de resultados y el listado mes a mes dejaron de vivir en
 * Inicio ⇒ el tab recupera su contenido propio (`/dashboard/resultados`: gráfico
 * de línea + `resultados-mensuales.tsx`).
 *
 * 🔑 **Alcance**: se muestra **solo en las pantallas principales** (decisión del
 * usuario, 2026-10-01): los 4 tabs de arriba y las sub-pantallas del hub "Más
 * opciones" (ej. Préstamos). En wizards, CRUDs y pantallas de detalle manda el `‹`
 * de la cabecera (§210), así no quedan 3 elementos fijos apilados en un celular.
 *
 * ⚠️ **Desktop (2026-10-17)**: la barra sigue visible en todos los tamaños (el
 * sidebar de `lg:` continúa parqueado para una segunda fase), pero en pantallas
 * grandes pasa a ser un **dock flotante**: 464 px, centrado, despegado 1.5rem del
 * borde, `rounded-full`, borde propio y sombra (ver el `@media (min-width: 1024px)`
 * de `[data-barra-nav]` en `globals.css`). Antes heredaba la estética mobile
 * —banda angosta pegada al borde con `border-t`— y se leía como una barra de
 * celular flotando sobre la tabla. El ítem activo suma una "píldora" de fondo.
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
 * 🔑 **Resultados usa `graph-up`** (2026-10-04, elegido por el usuario sobre un
 * preview con 22 opciones del set): el `chart` original se **confundía con
 * `bill-list`** de Gastos —a 21 px los dos son “líneas apiladas”— y `graph-up`
 * (línea que sube dentro del cuadrado redondeado) es el que dice **resultado mes a
 * mes**, que es lo que muestra el tab (gráfico de línea + listado mensual).
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
  {
    href: "/dashboard/resultados",
    label: "Resultados",
    icono: GraphUpLinear,
    iconoActivo: GraphUpDuotone,
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
  // Los destinos de la barra usan prefetch completo de Next al estar visibles.
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
      // ⚠️ Posición y alto: mobile y escritorio se resuelven en `globals.css`
      // (`[data-barra-nav]` + su `@media (min-width: 1024px)`) para poder cambiar
      // de banda pegada al borde a **dock flotante** sin `!important`.
      // · mobile: alto = banda (3.5rem) + safe-area topado a 2.5rem; el
      //   `padding-bottom` mantiene el contenido a ~28px del borde en todos los
      //   dispositivos.
      // · escritorio: dock centrado de 464px, despegado 1.5rem, `rounded-full`,
      //   borde propio y sombra (2026-10-17: antes heredaba la estética mobile y se
      //   leía como una barra de celular flotando sobre la tabla).
      className="fixed bottom-0 left-0 right-0 z-40 mx-auto flex max-w-lg items-stretch border-t border-border barra-nav-vidrio"
    >
      {/* Faldón: pinta el fondo de la barra **por debajo** de ella. Si el viewport
          de iOS termina antes que la pantalla (el caso del Pro Max), la franja que
          queda debajo muestra el fondo de la barra y no el de la página ⇒ la barra
          se ve pegada al borde. Si no hay franja, queda fuera de pantalla. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 right-0 top-full h-40 bg-sidebar lg:hidden"
      />
      {TABS.map((t) => {
        const activo = esActivo(t.href, ruta);
        const Icono = activo ? t.iconoActivo : t.icono;
        return (
          <Link
            key={t.href}
            href={t.href}
            prefetch
            aria-current={activo ? "page" : undefined}
            className={cn(
              // `justify-end`: el contenido se apoya arriba del padding del
              // safe-area ⇒ queda siempre a la misma distancia del borde inferior.
              // En escritorio el dock lo centra y el activo se marca con una
              // "píldora" de fondo (2026-10-17).
              "flex flex-1 flex-col items-center justify-end gap-1 transition-colors lg:justify-center lg:rounded-full",
              activo
                ? "text-header lg:bg-white/10"
                : "text-subtitle hover:text-label lg:hover:bg-white/5"
            )}
          >
            <Icono size={22} />
            <span className="text-[11px] font-medium leading-none">{t.label}</span>
          </Link>
        );
      })}

      {/* Último botón (5º, después de "Resultados"): **popup**, no pantalla.
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
          "flex flex-1 flex-col items-center justify-end gap-1 transition-colors lg:justify-center lg:rounded-full",
          masActivo
            ? "text-header lg:bg-white/10"
            : "text-subtitle hover:text-label lg:hover:bg-white/5"
        )}
      >
        {masActivo ? <HamburgerMenuDuotone size={22} /> : <HamburgerMenuLinear size={22} />}
        <span className="text-[11px] font-medium leading-none">Más</span>
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
