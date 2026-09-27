"use client";

import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Receipt, Send, Settings2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { usePrefetchNav } from "@/components/ui/nav-progress";

export interface CuentaAcciones {
  /** Id de la cuenta real (las sintéticas ya no existen: ver nota del componente). */
  id?: number;
  nombre: string;
}

/**
 * Popup de opciones de una cuenta (mobile y escritorio): registrar gasto,
 * transferir y ajustar cuenta (la tarjeta abre su historial al hacer clic).
 * Reutiliza `Modal`, que desde 2026-09-17 se puede pedir **centrado** (antes en
 * mobile era un bottom sheet anclado abajo) y el popup quedó **compacto y sin
 * encabezado**: sin título (⇒ sin botón ✕: se cierra tocando afuera o con
 * Escape), sin el saldo de la cuenta, sin chevrons y con las opciones más juntas.
 *
 * ⚠️ Se eliminaron las **tarjetas sintéticas** ("Por cobrar"/"Actuales") y con
 * ellas la prop `soloMovimiento` y la acción "Nuevo período": el panel Trabajo
 * muestra los **ítems pendientes de cobro** y esos períodos dejaron de ser algo
 * que el usuario gestione (`plan-liquidaciones.md`, P1.b).
 */
export function AccountActionsSheet({
  cuenta,
  open,
  onClose,
}: {
  cuenta: CuentaAcciones | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  // Prefetch al primer contacto (2026-09-17): los botones arman su URL al
  // vuelo, así que no pueden ser `<Link>`; con esto el wizard ya viene en camino
  // cuando el dedo toca la acción.
  const prefetch = usePrefetchNav();
  if (!cuenta) return null;

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
  // Transferir, Ajustar cuenta).
  const accionesTop: { icon: LucideIcon; label: string; href: string }[] = [
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
