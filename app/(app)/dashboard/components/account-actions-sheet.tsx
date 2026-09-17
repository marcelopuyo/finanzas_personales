"use client";

import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Briefcase,
  CalendarPlus,
  ClipboardList,
  Receipt,
  Send,
  Settings2,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { usePrefetchNav } from "@/components/ui/nav-progress";

export interface CuentaAcciones {
  /** Solo en cuentas reales; en tarjetas sintéticas (soloMovimiento) puede faltar. */
  id?: number;
  nombre: string;
}

/** Acción(es) únicas para tarjetas sintéticas (sin cuenta real detrás). */
export type AccionSintetica = "jornada" | "cobro" | "tarea" | "periodo";

/**
 * Popup de opciones de una cuenta (mobile y escritorio): registrar gasto,
 * transferir y ajustar cuenta (las cuentas reales abren su historial al hacer
 * clic en la tarjeta). Con `soloMovimiento` (tarjetas sintéticas como
 * "Actuales"/"Por cobrar") muestra únicamente esa opción. Reutiliza `Modal`, que
 * desde 2026-09-17 se puede pedir **centrado** (antes en mobile era un bottom
 * sheet anclado abajo) y el popup quedó **compacto y sin encabezado**: sin
 * título (⇒ sin botón ✕: se cierra tocando afuera o con Escape), sin el saldo de
 * la cuenta, sin chevrons y con las opciones más juntas.
 */
export function AccountActionsSheet({
  cuenta,
  open,
  onClose,
  soloMovimiento,
}: {
  cuenta: CuentaAcciones | null;
  open: boolean;
  onClose: () => void;
  /** Acciones para tarjetas sintéticas (sin cuenta real). */
  soloMovimiento?: AccionSintetica[];
}) {
  const router = useRouter();
  // Prefetch al primer contacto (2026-09-17): los botones arman su URL al
  // vuelo, así que no pueden ser `<Link>`; con esto el wizard ya viene en camino
  // cuando el dedo toca la acción.
  const prefetch = usePrefetchNav();
  if (!cuenta) return null;

  const SOLO_ACCIONES: Record<
    AccionSintetica,
    { icon: LucideIcon; label: string; href: string }
  > = {
    jornada: {
      icon: Briefcase,
      label: "Cargar jornada",
      href: "/movimientos/nuevo/jornada",
    },
    cobro: {
      icon: Banknote,
      label: "Cobro Sueldo",
      href: "/movimientos/nuevo/cobro",
    },
    tarea: {
      icon: ClipboardList,
      label: "Cargar tarea",
      href: "/movimientos/nuevo/tarea",
    },
    periodo: {
      icon: CalendarPlus,
      label: "Nuevo período",
      href: "/cruds/periodos-trabajo/nuevo?origen=dashboard",
    },
  };

  /** URL del wizard en modo directo, con el concepto y el rol de la cuenta. */
  const hrefWizard = (tipo: string, param: "cuenta" | "origen" | "destino") => {
    const qs = new URLSearchParams({ [param]: String(cuenta.id) });
    return `/movimientos/nuevo/${tipo}?${qs.toString()}`;
  };

  /** Navega y cierra el sheet. */
  const go = (href: string) => {
    router.push(href);
    onClose();
  };

  // Acciones de la cuenta real, en el orden del menú (Registrar gasto,
  // Transferir, Ajustar cuenta). En modo soloMovimiento (tarjetas sintéticas)
  // se muestran únicamente esas acciones.
  const accionesTop: { icon: LucideIcon; label: string; href: string }[] =
    soloMovimiento && soloMovimiento.length > 0
      ? soloMovimiento.map((k) => ({
          icon: SOLO_ACCIONES[k].icon,
          label: SOLO_ACCIONES[k].label,
          href: SOLO_ACCIONES[k].href,
        }))
      : [
          { icon: Receipt, label: "Registrar gasto", href: hrefWizard("gasto", "cuenta") },
          { icon: Send, label: "Transferir", href: hrefWizard("transferencia", "origen") },
          { icon: Settings2, label: "Ajustar cuenta", href: hrefWizard("ajuste", "cuenta") },
        ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      // Sin `title` (pedido del usuario 2026-09-17): el popup queda mínimo.
      // ⚠️ Eso también quita el botón ✕ del encabezado: el popup se cierra
      // tocando afuera o con Escape. Centrado en la MITAD de la pantalla (y no
      // anclado abajo) + más angosto.
      centrado
    >
      <div className="space-y-2">
        {/* Solo el nombre de la cuenta: el SALDO se quitó (pedido del usuario
            2026-09-17) para que el popup sea más chico. */}
        <p className="px-2 text-[13px] font-medium text-header">
          {cuenta.nombre}
        </p>
        {/* Opciones juntas y sin chevron (el chevron se quitó para compactar). */}
        <div className="space-y-0.5">
          {accionesTop.map((row) => (
            <button
              key={row.label}
              type="button"
              onClick={() => go(row.href)}
              onTouchStart={() => prefetch(row.href)}
              onMouseEnter={() => prefetch(row.href)}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
                <row.icon className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1 text-[13.5px] font-medium text-card-foreground">
                {row.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
