"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Receipt, Send, Settings2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { usePrefetchNav } from "@/components/ui/nav-progress";

/**
 * **FAB "+"** (2026-10-01, rama `rediseno-ui`) — la entrada al registro.
 *
 * Decisión del usuario: sin "+" central en la barra inferior, y el **🎤 se mudó a
 * la top bar** ⇒ la esquina inferior derecha queda libre para el "+", que es donde
 * el pulgar la encuentra (§ la referencia de diseño).
 *
 * 🔑 **Solo aparece donde se usa**: hoy únicamente en **Inicio**, y con la **cuenta
 * en foco** precargada en el wizard (como hacía el popup de la tarjeta).
 *
 * Ofrece los 3 flujos manuales (Gasto · Transferencia · Ajuste) + **"Ver todos los
 * tipos"**, porque en la app hay **8 conceptos** y los otros 5 (Cobrar trabajo,
 * Pago de préstamo, Pago de gasto, Jornada, Tarea) se lanzan desde contexto.
 *
 * ⚠️ No es el único camino: el **long press** sobre la tarjeta de la cuenta sigue
 * abriendo el popup de acciones (`AccountActionsSheet`) con la misma cuenta.
 */
export function FabNuevo({ cuentaId }: { cuentaId?: number }) {
  const router = useRouter();
  const prefetch = usePrefetchNav();
  const [open, setOpen] = useState(false);

  /** URL del wizard en modo directo, con el concepto y el rol de la cuenta. */
  const hrefWizard = (tipo: string, param: "cuenta" | "origen") =>
    cuentaId != null
      ? `/movimientos/nuevo/${tipo}?${new URLSearchParams({ [param]: String(cuentaId) })}`
      : `/movimientos/nuevo/${tipo}`;

  const acciones = [
    { icon: Receipt, label: "Gasto", href: hrefWizard("gasto", "cuenta") },
    {
      icon: Send,
      label: "Transferencia",
      href: hrefWizard("transferencia", "origen"),
    },
    { icon: Settings2, label: "Ajuste de cuenta", href: hrefWizard("ajuste", "cuenta") },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-fab-nuevo=""
        aria-label="Nuevo movimiento"
        title="Nuevo movimiento"
        className="fixed right-4 z-30 flex h-13 w-13 items-center justify-center rounded-full bg-header text-background shadow-lg transition-transform active:scale-95"
        // Por encima de la barra inferior (4rem) + su safe-area.
        style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
      >
        <span className="text-[26px] font-light leading-none">+</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} centrado>
        <div className="-mx-1">
          {acciones.map((a) => (
            <button
              key={a.label}
              type="button"
              onPointerEnter={() => prefetch(a.href)}
              onTouchStartCapture={() => prefetch(a.href)}
              onClick={() => {
                setOpen(false);
                router.push(a.href);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted"
            >
              <a.icon className="h-5 w-5 text-subtitle" />
              <span className="text-[14px] text-card-foreground">{a.label}</span>
            </button>
          ))}
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            onPointerEnter={() => prefetch("/movimientos")}
            onClick={() => {
              setOpen(false);
              router.push("/movimientos");
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted"
          >
            <ArrowRight className="h-5 w-5 text-subtitle" />
            <span className="text-[14px] text-card-foreground">
              Ver todos los tipos
            </span>
          </button>
        </div>
      </Modal>
    </>
  );
}
