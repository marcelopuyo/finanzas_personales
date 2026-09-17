"use client";

import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Briefcase,
  CalendarPlus,
  ChevronRight,
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
  /** Saldo ya formateado como moneda. */
  saldo: string;
}

/** Acción(es) únicas para tarjetas sintéticas (sin cuenta real detrás). */
export type AccionSintetica = "jornada" | "cobro" | "tarea" | "periodo";

/**
 * Bottom sheet (mobile) / diálogo centrado (desktop) con las acciones de una
 * cuenta: registrar gasto, transferir y ajustar cuenta (las cuentas reales
 * abren su historial al hacer clic en la tarjeta). Con `soloMovimiento`
 * (tarjetas sintéticas como "Actuales"/"Por cobrar") muestra
 * únicamente esa opción. Reutiliza `Modal`.
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
      title="Opciones de la cuenta"
      className="sm:max-w-sm"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
          <p className="text-[13px] font-medium text-header">{cuenta.nombre}</p>
          <p className="text-[15px] font-semibold tracking-tight text-value">
            {cuenta.saldo}
          </p>
        </div>
        <div className="space-y-1">
          {accionesTop.map((row) => (
            <button
              key={row.label}
              type="button"
              onClick={() => go(row.href)}
              onTouchStart={() => prefetch(row.href)}
              onMouseEnter={() => prefetch(row.href)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
                <row.icon className="h-4 w-4" />
              </span>
              <span className="flex-1 text-[14px] font-medium text-card-foreground">
                {row.label}
              </span>
              <ChevronRight className="h-4 w-4 text-subtitle" />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
