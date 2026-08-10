"use client";

import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Briefcase,
  ChevronRight,
  Download,
  HandCoins,
  History,
  Receipt,
  Send,
  Settings2,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";

export interface CuentaAcciones {
  /** Solo en cuentas reales; en tarjetas sintéticas (soloMovimiento) puede faltar. */
  id?: number;
  nombre: string;
  /** Saldo ya formateado como moneda. */
  saldo: string;
}

/** Acción única para tarjetas sintéticas (sin cuenta real detrás). */
export type AccionSintetica = "jornada" | "cobro";

/**
 * Bottom sheet (mobile) / diálogo centrado (desktop) con las acciones de una
 * cuenta: ver historial y disparar los movimientos en los que interviene.
 * Con `soloMovimiento` (tarjetas sintéticas como "Períodos Actuales"/"Períodos
 * a Cobrar") muestra únicamente esa opción. Reutiliza `Modal`.
 */
export function AccountActionsSheet({
  cuenta,
  open,
  onClose,
  onVerHistorial,
  soloMovimiento,
}: {
  cuenta: CuentaAcciones | null;
  open: boolean;
  onClose: () => void;
  onVerHistorial?: () => void;
  /** Modo con una sola acción (tarjetas sintéticas, sin cuenta real). */
  soloMovimiento?: AccionSintetica;
}) {
  const router = useRouter();
  if (!cuenta) return null;

  const SOLO_ACCIONES: Record<
    AccionSintetica,
    { icon: LucideIcon; label: string; href: string }
  > = {
    jornada: {
      icon: Briefcase,
      label: "Jornada trabajo",
      href: "/movimientos/nuevo/jornada",
    },
    cobro: {
      icon: Banknote,
      label: "Cobro Sueldo",
      href: "/movimientos/nuevo/cobro",
    },
  };

  /** Navega al wizard en modo directo con el concepto y el rol de la cuenta precargados. */
  const go = (tipo: string, param: "cuenta" | "origen" | "destino") => {
    const qs = new URLSearchParams({ [param]: String(cuenta.id) });
    router.push(`/movimientos/nuevo/${tipo}?${qs.toString()}`);
    onClose();
  };

  const rows: { icon: LucideIcon; label: string; onClick: () => void }[] =
    soloMovimiento
      ? [
          {
            icon: SOLO_ACCIONES[soloMovimiento].icon,
            label: SOLO_ACCIONES[soloMovimiento].label,
            onClick: () => {
              router.push(SOLO_ACCIONES[soloMovimiento].href);
              onClose();
            },
          },
        ]
      : [
          {
            icon: History,
            label: "Ver historial",
            onClick: () => {
              onVerHistorial?.();
              onClose();
            },
          },
          { icon: Banknote, label: "Cobro Sueldo", onClick: () => go("cobro", "cuenta") },
          { icon: HandCoins, label: "Pago Préstamo", onClick: () => go("pago-prestamo", "cuenta") },
          { icon: Settings2, label: "Ajuste Cuenta", onClick: () => go("ajuste", "cuenta") },
          { icon: Receipt, label: "Gasto", onClick: () => go("gasto", "cuenta") },
          { icon: Send, label: "Transferir desde", onClick: () => go("transferencia", "origen") },
          { icon: Download, label: "Transferir hacia", onClick: () => go("transferencia", "destino") },
          { icon: Briefcase, label: "Jornada trabajo", onClick: () => go("jornada", "cuenta") },
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
          {rows.map((row, i) => (
            <div key={row.label}>
              {i === 1 && <div className="my-1 h-px bg-border" />}
              <button
                type="button"
                onClick={row.onClick}
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
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
