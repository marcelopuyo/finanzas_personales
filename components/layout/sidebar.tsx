"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  CreditCard,
  HandCoins,
  Briefcase,
  Tags,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ThemeToggle from "./theme-toggle";

interface NavItem {
  label: string;
  href?: string;
  icon?: React.ElementType;
  children?: { label: string; href: string }[];
}

const mainNav: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Movimientos", href: "/movimientos", icon: ArrowLeftRight },
];

const crudNav: NavItem[] = [
  {
    label: "Gastos",
    icon: Wallet,
    children: [
      { label: "Categorías", href: "/categorias-gasto" },
      { label: "Períodos", href: "/periodos-gasto" },
      { label: "Gastos", href: "/gastos" },
    ],
  },
  {
    label: "Cuentas",
    icon: Wallet,
    children: [
      { label: "Tipos", href: "/tipos-cuenta" },
      { label: "Cuentas", href: "/cuentas" },
    ],
  },
  {
    label: "Tarjetas",
    icon: CreditCard,
    children: [
      { label: "Tarjetas", href: "/tarjetas" },
      { label: "Períodos", href: "/periodos-tarjeta" },
      { label: "Movimientos", href: "/movimientos-tarjeta" },
    ],
  },
  { label: "Préstamos", href: "/prestamos", icon: HandCoins },
  {
    label: "Trabajos",
    icon: Briefcase,
    children: [
      { label: "Trabajos", href: "/trabajos" },
      { label: "Períodos", href: "/periodos-trabajo" },
      { label: "Jornadas", href: "/jornadas-trabajo" },
    ],
  },
  {
    label: "Maestros",
    icon: Tags,
    children: [
      { label: "Conceptos", href: "/conceptos" },
      { label: "Personas", href: "/personas" },
      { label: "Monedas", href: "/monedas" },
      { label: "Cotizaciones", href: "/cotizaciones" },
      { label: "Inflación", href: "/inflacion" },
    ],
  },
];

function NavSection({
  title,
  items,
  pathname,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
}) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {title}
      </p>
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavItem key={item.label} item={item} pathname={pathname} />
        ))}
      </div>
    </div>
  );
}

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
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-blue-50 text-blue-700 dark:bg-neutral-800 dark:text-neutral-200"
            : "text-gray-700 hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        )}
      >
        {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
        <span>{item.label}</span>
      </Link>
    );
  }

  const hasActiveChild = item.children.some((c) => pathname.startsWith(c.href));

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          hasActiveChild
            ? "text-blue-700 dark:text-neutral-200"
            : "text-gray-700 hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        )}
      >
        {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
        <span className="flex-1 text-left">{item.label}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-neutral-600" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-neutral-600" />
        )}
      </button>
      {open && (
        <div className="ml-6 mt-0.5 flex flex-col gap-0.5 border-l border-gray-200 dark:border-neutral-800 pl-3">
          {item.children.map((child) => {
            const isChildActive = pathname.startsWith(child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  isChildActive
                    ? "bg-blue-50 text-blue-700 font-medium dark:bg-neutral-800 dark:text-neutral-200"
                    : "text-gray-600 hover:bg-gray-100 dark:text-neutral-500 dark:hover:bg-neutral-800"
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
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-50 rounded-lg bg-white dark:bg-neutral-900 p-2 shadow-md text-gray-700 dark:text-neutral-300 lg:hidden"
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - Hashnode style */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 flex h-full w-60 flex-col border-r border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 transition-transform duration-200",
          "lg:translate-x-0 lg:static lg:z-auto",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo / Brand */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <LayoutDashboard className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-neutral-100">Finanzas</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3">
          <NavSection title="Principal" items={mainNav} pathname={pathname} />
          <NavSection title="Módulos" items={crudNav} pathname={pathname} />
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <ThemeToggle />
            {/* User avatar */}
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              <User className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
