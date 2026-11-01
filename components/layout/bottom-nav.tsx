"use client";

import { useRef, useState } from "react";
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
 * 🔑 **Estética “liquid glass” (2026-11-01, pedido del usuario sobre la captura
 * del tab bar de WhatsApp)**: la barra **flota** —despegada de los bordes, forma
 * de pastilla— en mobile y en escritorio (acá además se angosta a 464 px,
 * centrada). El vidrio es **semi-transparente**: `backdrop-filter` con desenfoque
 * + saturación, brillo especular arriba y borde de 1 px. Antes en mobile era una
 * banda pegada al borde con `border-t` y el activo sólo cambiaba de color
 * (mobile) o sumaba una píldora (escritorio) ⇒ ahora la estética es **la misma en
 * los dos**: el activo lo marca un **indicador que se desliza** entre secciones
 * (ver abajo). Medidas y material viven en `[data-barra-nav]` (`globals.css`).
 *
 * 🎞️ **Indicador deslizante**: es **un solo** elemento (`data-barra-indicador`)
 * que se mueve con `translateX` —no una píldora por ítem—, así el movimiento se
 * ve continuo al cambiar de sección, como en WhatsApp. Los 5 ítems son `flex-1`
 * ⇒ cada uno mide exactamente 1/5 de la barra y el indicador se posiciona con
 * `translateX(<índice>00%)` (porcentaje de **su propio** ancho). Al tocar se
 * mueve **al instante** (`moverIndicador`, sin esperar a que llegue la página) y
 * después el índice vuelve a derivarse de la ruta: si la navegación se cancela,
 * el próximo render lo corrige.
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

/**
 * Posición del indicador deslizante: `0..TABS.length-1` para las secciones y
 * `TABS.length` para el botón "Más" (que también se marca cuando estamos en
 * alguna de sus pantallas). `-1` = ninguna sección activa (p. ej. `/perfil`):
 * ahí el indicador se apaga.
 */
function indiceDeRuta(ruta: string): number {
  const i = TABS.findIndex((t) => esActivo(t.href, ruta));
  if (i >= 0) return i;
  return OPCIONES_MAS.some((o) => ruta.startsWith(o.href)) ? TABS.length : -1;
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
  /** Índice del indicador deslizante según la ruta (ver `indiceDeRuta`). */
  const indice = indiceDeRuta(ruta);
  /**
   * Ref del indicador: al tocar un tab se lo mueve **ya** (antes de que la
   * navegación cambie `usePathname`), que es lo que hace que el gesto se sienta
   * inmediato. No usa estado propio porque el valor "verdadero" siempre es la
   * ruta; si el push falla, el próximo render con otra ruta lo reacomoda.
   */
  const indicadorRef = useRef<HTMLSpanElement | null>(null);
  const moverIndicador = (i: number) => {
    const el = indicadorRef.current;
    if (!el) return;
    el.style.transform = `translateX(${i}00%)`;
    el.style.opacity = "1";
  };

  return (
    <>
    <nav
      // `data-barra-nav` lo usan el FAB "+" y la barra de acciones para apilarse
      // por encima (misma idea que `data-barra-inferior`, ver `globals.css`).
      data-barra-nav=""
      aria-label="Secciones"
      // ⚠️ Posición, alto y material: TODO en `globals.css` (`[data-barra-nav]` +
      // su `@media (min-width: 1024px)`), para que la barra, la barra de acciones
      // y los FAB compartan las mismas medidas (`--fp-barra-alto` / `-sep`).
      className="fixed z-40 mx-auto flex max-w-lg items-stretch"
    >
      {/* Indicador deslizante del activo (2026-11-01): UN solo elemento que se
          mueve con `translateX(índice × 100%)` de su propio ancho. Como los 5
          ítems son `flex-1`, cada uno mide 1/5 de la barra y el indicador cae
          siempre exacto arriba del ítem activo. `opacity: 0` cuando la ruta no
          pertenece a ninguna sección (p. ej. `/perfil`). */}
      <span
        ref={indicadorRef}
        aria-hidden="true"
        data-barra-indicador=""
        style={{
          transform: `translateX(${Math.max(indice, 0)}00%)`,
          opacity: indice < 0 ? 0 : 1,
        }}
      >
        <span className="barra-nav-capsula" />
      </span>

      {TABS.map((t, i) => {
        const activo = esActivo(t.href, ruta);
        const Icono = activo ? t.iconoActivo : t.icono;
        return (
          <Link
            key={t.href}
            href={t.href}
            prefetch
            aria-current={activo ? "page" : undefined}
            // Mueve el indicador ya mismo (el estado "real" sigue siendo la ruta).
            onClick={() => moverIndicador(i)}
            className={cn(
              // `relative z-10`: los ítems van por encima del indicador.
              "relative z-10 flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
              activo ? "text-header" : "text-subtitle hover:text-label"
            )}
          >
            <Icono
              size={22}
              // Micro-pop del icono al quedar activo (mismo gesto que WhatsApp).
              className={cn(
                "transition-transform duration-300",
                activo && "scale-105"
              )}
            />
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
        // ⚠️ **No** mueve el indicador: este botón no navega (abre el popup). El
        // indicador se corre a "Más" recién cuando se entra a una de sus
        // pantallas (`masActivo` ⇒ `indiceDeRuta` devuelve `TABS.length`).
        className={cn(
          "relative z-10 flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
          masActivo ? "text-header" : "text-subtitle hover:text-label"
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
