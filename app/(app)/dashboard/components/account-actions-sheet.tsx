"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Coins,
  HandCoins,
  History,
  Receipt,
  Send,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  // Colapsable "Préstamos": agrupa las acciones vinculadas a préstamos.
  const [prestamosOpen, setPrestamosOpen] = useState(false);
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

  // Acciones generales (siempre visibles). En modo soloMovimiento (tarjetas
  // sintéticas) se muestra únicamente la acción de esa tarjeta.
  const accionesTop: { icon: LucideIcon; label: string; onClick: () => void }[] =
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
        ];

  // Acciones de préstamos, agrupadas en el colapsable "Préstamos". El pago y
  // el cobro comparten el wizard "Pago Préstamo": el backend resuelve la
  // dirección (ingreso/egreso) según el sentido del préstamo seleccionado.
  const accionesPrestamo: { icon: LucideIcon; label: string; onClick: () => void }[] =
    soloMovimiento
      ? []
      : [
          { icon: HandCoins, label: "Pago Préstamo", onClick: () => go("pago-prestamo", "cuenta") },
          {
            icon: Coins,
            label: "Nuevo préstamo",
            onClick: () => {
              // El alta de préstamo es un CRUD: se precarga la cuenta (por
              // NOMBRE, como espera el formulario) desde la que se dispara.
              const qs = new URLSearchParams({ cuenta: cuenta.nombre });
              router.push(`/cruds/prestamos/nuevo?${qs.toString()}`);
              onClose();
            },
          },
        ];

  // Acciones finales (después del bloque de préstamos).
  const accionesBottom: { icon: LucideIcon; label: string; onClick: () => void }[] =
    soloMovimiento
      ? []
      : [
          { icon: Settings2, label: "Ajuste Cuenta", onClick: () => go("ajuste", "cuenta") },
          { icon: Receipt, label: "Gasto", onClick: () => go("gasto", "cuenta") },
          { icon: Send, label: "Transferir", onClick: () => go("transferencia", "origen") },
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
          ))}

          {accionesPrestamo.length > 0 && (
            <>
              <div className="my-1 h-px bg-border" />
              <div>
                <button
                  type="button"
                  onClick={() => setPrestamosOpen((v) => !v)}
                  aria-expanded={prestamosOpen}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
                    <HandCoins className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-[14px] font-medium text-card-foreground">
                    Préstamos
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 text-subtitle transition-transform",
                      prestamosOpen && "rotate-180"
                    )}
                  />
                </button>
                {prestamosOpen && (
                  <div className="space-y-1 pt-0.5">
                    {accionesPrestamo.map((row) => (
                      <button
                        key={row.label}
                        type="button"
                        onClick={row.onClick}
                        className="flex w-full items-center gap-3 rounded-lg py-2.5 pl-12 pr-2 text-left transition-colors hover:bg-muted"
                      >
                        <span className="flex-1 text-[14px] font-medium text-card-foreground">
                          {row.label}
                        </span>
                        <ChevronRight className="h-4 w-4 text-subtitle" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {accionesBottom.length > 0 && (
            <>
              <div className="my-1 h-px bg-border" />
              {accionesBottom.map((row) => (
                <button
                  key={row.label}
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
              ))}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
