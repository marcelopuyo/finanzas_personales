"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Menu,
  X,
  User,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHouse,
  faArrowRightArrowLeft,
  faWallet,
  faLandmark,
  faCreditCard,
  faHandHoldingDollar,
  faBriefcase,
  faTags,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";
import ThemeToggle from "./theme-toggle";

interface NavItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: { label: string; href: string }[];
}

const navigation: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: () => <FontAwesomeIcon icon={faHouse} style={{ width: 20, height: 20, color: "#8f9094" }} />,
  },
  {
    label: "Movimientos",
    href: "/movimientos",
    icon: () => <FontAwesomeIcon icon={faArrowRightArrowLeft} style={{ width: 20, height: 20, color: "#8f9094" }} />,
  },
  {
    label: "Gastos",
    icon: () => <FontAwesomeIcon icon={faWallet} style={{ width: 20, height: 20, color: "#8f9094" }} />,
    children: [
      { label: "Categorías", href: "/categorias-gasto" },
      { label: "Períodos", href: "/periodos-gasto" },
      { label: "Gastos", href: "/gastos" },
    ],
  },
  {
    label: "Cuentas",
    icon: () => <FontAwesomeIcon icon={faLandmark} style={{ width: 20, height: 20, color: "#8f9094" }} />,
    children: [
      { label: "Tipos", href: "/tipos-cuenta" },
      { label: "Cuentas", href: "/cuentas" },
    ],
  },
  {
    label: "Tarjetas",
    icon: () => <FontAwesomeIcon icon={faCreditCard} style={{ width: 20, height: 20, color: "#8f9094" }} />,
    children: [
      { label: "Tarjetas", href: "/tarjetas" },
      { label: "Períodos", href: "/periodos-tarjeta" },
      { label: "Movimientos", href: "/movimientos-tarjeta" },
    ],
  },
  {
    label: "Préstamos",
    href: "/prestamos",
    icon: () => <FontAwesomeIcon icon={faHandHoldingDollar} style={{ width: 20, height: 20, color: "#8f9094" }} />,
  },
  {
    label: "Trabajos",
    icon: () => <FontAwesomeIcon icon={faBriefcase} style={{ width: 20, height: 20, color: "#8f9094" }} />,
    children: [
      { label: "Trabajos", href: "/trabajos" },
      { label: "Períodos", href: "/periodos-trabajo" },
      { label: "Jornadas", href: "/jornadas-trabajo" },
    ],
  },
  {
    label: "Maestros",
    icon: () => <FontAwesomeIcon icon={faTags} style={{ width: 20, height: 20, color: "#8f9094" }} />,
    children: [
      { label: "Conceptos", href: "/conceptos" },
      { label: "Personas", href: "/personas" },
      { label: "Monedas", href: "/monedas" },
      { label: "Cotizaciones", href: "/cotizaciones" },
      { label: "Inflación", href: "/inflacion" },
    ],
  },
];

function NavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const [open, setOpen] = useState(() =>
    item.children?.some((c) => pathname.startsWith(c.href))
  );

  if (!item.children) {
    const isActive =
      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href || "");
    return (
      <Link
        href={item.href || "#"}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-[9px] text-[14px] leading-5 transition-colors",
          isActive
            ? "bg-[#353638] text-[#ffffff]"
            : "text-[#f0f1f2] hover:bg-[#2a2b2d]"
        )}
      >
        {item.icon && <item.icon className="h-4 w-4 shrink-0 opacity-80" />}
        {item.label}
      </Link>
    );
  }

  const hasActiveChild = item.children.some((c) => pathname.startsWith(c.href));

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-[9px] text-[14px] leading-5 text-left transition-colors",
          hasActiveChild
            ? "text-[#ffffff]"
            : "text-[#f0f1f2] hover:bg-[#2a2b2d]"
        )}
      >
        {item.icon && <item.icon className="h-4 w-4 shrink-0 opacity-80" />}
        {item.label}
      </button>
      {open && (
        <div className="ml-7 mt-1 flex flex-col gap-0.5">
          {item.children.map((child) => {
            const isChildActive = pathname.startsWith(child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "block rounded-md px-3 py-[6px] text-[14px] leading-5 transition-colors",
                  isChildActive
                    ? "text-[#ffffff] font-medium"
                    : "text-[#f0f1f2] hover:text-[#ffffff]"
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

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 rounded-lg bg-[#1b1b1c] p-2 text-[#f0f1f2] lg:hidden"
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X style={{ width: 20, height: 20, color: "#8f9094" }} /> : <Menu style={{ width: 20, height: 20, color: "#8f9094" }} />}
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-40 flex h-screen w-64 flex-col bg-[#1b1b1c] transition-transform duration-200",
          "lg:translate-x-0 lg:static lg:z-auto lg:h-screen",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="px-4 pt-6 pb-4">
          <span className="text-[14px] font-semibold text-[#f0f1f2]">Finanzas</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
          {navigation.map((item, i) => (
            <NavItem key={i} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="px-3 py-3 flex items-center justify-between">
          <ThemeToggle />
          <button className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4c6ef5] text-[11px] font-semibold text-white">
            <User className="h-3.5 w-3.5" />
          </button>
        </div>
      </aside>
    </>
  );
}
