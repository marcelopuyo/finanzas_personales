"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartLine,
  faWallet,
  faLandmark,
  faCreditCard,
  faHandHoldingDollar,
  faHardHat,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import Logo from "./logo";

interface NavItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: { label: string; href: string }[];
}

const navigation: NavItem[] = [
  {
    label: "Resumen",
    href: "/dashboard",
    icon: () => <FontAwesomeIcon icon={faChartLine} style={{ width: 20, height: 20, color: "var(--sidebar-muted)" }} />,
  },
  // "Movimientos" (stepper) OCULTO del sidebar: los movimientos se disparan
  // desde las tarjetas del dashboard (menú ⋮ → rutas directas
  // /movimientos/nuevo/...). El stepper sigue vivo en /movimientos.
  {
    label: "Gastos",
    icon: () => <FontAwesomeIcon icon={faWallet} style={{ width: 20, height: 20, color: "var(--sidebar-muted)" }} />,
    children: [
      { label: "Categorías", href: "/cruds/categorias-gasto" },
      { label: "Períodos", href: "/cruds/periodos-gasto" },
      { label: "Gastos", href: "/cruds/gastos" },
    ],
  },
  {
    label: "Cuentas",
    icon: () => <FontAwesomeIcon icon={faLandmark} style={{ width: 20, height: 20, color: "var(--sidebar-muted)" }} />,
    children: [{ label: "Cuentas", href: "/cruds/cuentas" }],
  },
  {
    label: "Tarjetas",
    icon: () => <FontAwesomeIcon icon={faCreditCard} style={{ width: 20, height: 20, color: "var(--sidebar-muted)" }} />,
    children: [
      { label: "Tarjetas", href: "/cruds/tarjetas" },
      { label: "Períodos", href: "/cruds/periodos-tarjeta" },
      { label: "Movimientos", href: "/cruds/movimientos-tarjeta" },
    ],
  },
  {
    label: "Préstamos",
    icon: () => <FontAwesomeIcon icon={faHandHoldingDollar} style={{ width: 20, height: 20, color: "var(--sidebar-muted)" }} />,
    children: [
      { label: "Préstamos", href: "/cruds/prestamos" },
      { label: "Personas", href: "/cruds/personas" },
    ],
  },
  {
    label: "Trabajos",
    icon: () => <FontAwesomeIcon icon={faHardHat} style={{ width: 20, height: 20, color: "var(--sidebar-muted)" }} />,
    children: [
      { label: "Trabajos", href: "/cruds/trabajos" },
      { label: "Períodos", href: "/cruds/periodos-trabajo" },
      { label: "Jornadas", href: "/cruds/jornadas-trabajo" },
    ],
  },
];

/** ¿`pathname` está dentro de `href` (para marcar activo el item del sidebar)?
 * Excepción: las rutas directas de movimientos (`/movimientos/nuevo/...`,
 * sin stepper) NO activan el item "Movimientos". */
function isActivePath(href: string, pathname: string): boolean {
  if (href === "/movimientos" && pathname.startsWith("/movimientos/nuevo")) {
    return false;
  }
  return pathname.startsWith(href);
}

function NavItem({
  item,
  pathname,
  open,
  onToggle,
  onSelect,
}: {
  item: NavItem;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  /** Se ejecuta al hacer click en un item sin hijos (cierra el grupo abierto). */
  onSelect?: () => void;
}) {
  if (!item.children) {
    const isActive = isActivePath(item.href || "", pathname);
    return (
      <Link
        href={item.href || "#"}
        onClick={onSelect}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-[9px] text-[14px] leading-5 transition-colors",
          isActive
            ? "bg-sidebar-active text-sidebar-active-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-hover"
        )}
      >
        {item.icon && (
          <span className="flex w-5 shrink-0 items-center justify-end">
            <item.icon />
          </span>
        )}
        {item.label}
      </Link>
    );
  }

  const hasActiveChild = item.children.some((c) => isActivePath(c.href, pathname));

  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-[9px] text-[14px] leading-5 text-left transition-colors",
          hasActiveChild
            ? "bg-sidebar-active text-sidebar-active-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-hover"
        )}
      >
        {item.icon && (
          <span className="flex w-5 shrink-0 items-center justify-end">
            <item.icon />
          </span>
        )}
        {item.label}
      </button>
      {open && (
        <div className="ml-7 mt-1 flex flex-col gap-0.5">
          {item.children.map((child) => {
            const isChildActive = isActivePath(child.href, pathname);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "block rounded-md px-3 py-[6px] text-[14px] leading-5 transition-colors",
                  isChildActive
                    ? "bg-sidebar-active text-sidebar-active-foreground font-medium"
                    : "text-sidebar-foreground hover:text-sidebar-active-foreground"
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ initial = "U" }: { initial?: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  // "Perfil" es un avatar tipo DeepSeek: círculo algo más grande que los demás
  // íconos, tono distinto y la primera letra del nombre/email del usuario.
  const nav: NavItem[] = [
    ...navigation,
    {
      label: "Perfil",
      href: "/perfil",
      icon: () => (
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#414346] text-[15px] font-semibold text-[#f0f1f2]"
          style={{ width: 32, height: 32 }}
        >
          {initial}
        </span>
      ),
    },
  ];

  // Acordeón: solo un grupo abierto a la vez. Inicialmente se abre el del item activo.
  const [openGroup, setOpenGroup] = useState<string | null>(() => {
    const activeGroup = nav.find((item) =>
      item.children?.some((c) => isActivePath(c.href, pathname))
    );
    return activeGroup?.label ?? null;
  });

  // Mobile-first: al navegar (el pathname cambia al tocar una opción del menú)
  // se cierra el drawer automáticamente. En desktop no tiene efecto (el drawer
  // solo existe en lg-, donde el sidebar es estático).
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Bloquea el scroll del body mientras el drawer móvil está abierto (mismo
  // patrón que el Modal). En desktop (lg) el sidebar es estático, nunca drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Si se cruza a desktop (lg+) con el drawer abierto, se cierra: esto además
  // libera el scroll del body (el cleanup del efecto anterior) y evita que el
  // sidebar móvil quede "abierto" sin sentido en pantallas grandes.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <>
      {/* Top bar móvil: logo SIEMPRE visible + toggle del drawer (solo <lg).
          En desktop (lg+) el logo vive en el header del sidebar estático. */}
      <header className="fixed top-0 right-0 left-0 z-50 flex h-14 items-center gap-2 border-b border-border bg-sidebar px-4 lg:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-sidebar-foreground hover:bg-sidebar-hover"
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X style={{ width: 20, height: 20, color: "var(--sidebar-muted)" }} /> : <Menu style={{ width: 20, height: 20, color: "var(--sidebar-muted)" }} />}
        </button>
        <Logo size={20} />
      </header>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-40 flex h-screen w-64 flex-col bg-sidebar transition-[transform,visibility] duration-200",
          // En móvil el drawer arranca debajo de la top bar (h-14) para no
          // quedar oculto tras ella; en lg+ el sidebar es estático.
          "pt-14 lg:pt-0",
          "lg:translate-x-0 lg:static lg:z-auto lg:h-screen",
          // Cerrado en móvil: queda fuera de pantalla Y fuera del tab-order /
          // árbol de accesibilidad (invisible), pero visible y estático en lg+.
          mobileOpen
            ? "translate-x-0 visible"
            : "-translate-x-full invisible lg:visible"
        )}
      >
        <div className="hidden px-4 pt-6 pb-4 lg:block">
          <Logo />
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
          {nav.map((item) => (
            <NavItem
              key={item.label}
              item={item}
              pathname={pathname}
              open={item.children ? openGroup === item.label : false}
              onToggle={() =>
                setOpenGroup((cur) => (cur === item.label ? null : item.label))
              }
              // Item hoja (Dashboard, Perfil): al hacer click colapsa cualquier
              // grupo expandido (mismo comportamiento de acordeón que los demás).
              onSelect={() => setOpenGroup(null)}
            />
          ))}
        </nav>
      </aside>
    </>
  );
}
