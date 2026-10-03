"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Receipt, Send, Settings2, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { usePrefetchNav } from "@/components/ui/nav-progress";
import { cn } from "@/lib/utils";

/**
 * **Base visual compartida por los dos FAB de Inicio** (2026-10-02): el de
 * *nuevo movimiento* y el de *gestionar cuentas*. Una sola fuente para el
 * tamaño, la posición y la animación (regla de la app: FAB **blanco**,
 * `bg-header text-background`).
 *
 * 🔑 **`visible = false` lo difumina y lo deja inerte** en vez de desmontarlo:
 * el carrusel de Inicio cambia de tarjeta al deslizar, así que los dos FAB se
 * cruzan con un fade (transparente + `pointer-events-none` + `aria-hidden` +
 * fuera del orden de tabulación).
 */
function claseFab(visible: boolean) {
  return cn(
    "fixed right-4 z-30 flex h-13 w-13 items-center justify-center rounded-full bg-header text-background shadow-lg transition-[transform,opacity] duration-200 active:scale-95",
    visible ? "opacity-100" : "pointer-events-none opacity-0"
  );
}

/** `bottom` del FAB: por encima de la barra inferior (4rem) + su safe-area. */
const ESTILO_FAB = {
  bottom: "calc(4.75rem + env(safe-area-inset-bottom))",
} as const;

/** Ruta del CRUD de cuentas (la única acción de la tarjeta de resumen). */
export const HREF_CUENTAS = "/cruds/cuentas?origen=dashboard";

/**
 * Las **3 acciones del registro manual** (Gasto · Transferencia · Ajuste de
 * cuenta) con la **cuenta en foco** precargada en el wizard.
 *
 * 🔑 **Fuente ÚNICA** (2026-10-02): la usan el FAB "+" de Inicio y las
 * **acciones dentro del carrusel** —así el set queda idéntico en los dos lugares—.
 */
export function accionesNuevoMovimiento(cuentaId?: number) {
  /** URL del wizard en modo directo, con el concepto y el rol de la cuenta. */
  const hrefWizard = (tipo: string, param: "cuenta" | "origen") =>
    cuentaId != null
      ? `/movimientos/nuevo/${tipo}?${new URLSearchParams({ [param]: String(cuentaId) })}`
      : `/movimientos/nuevo/${tipo}`;
  return [
    { icon: Receipt, label: "Gasto", href: hrefWizard("gasto", "cuenta") },
    {
      icon: Send,
      label: "Transferencia",
      href: hrefWizard("transferencia", "origen"),
    },
    {
      icon: Settings2,
      label: "Ajuste de cuenta",
      href: hrefWizard("ajuste", "cuenta"),
    },
  ];
}

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
 * Ofrece los 3 flujos manuales (**Gasto · Transferencia · Ajuste de cuenta**), que
 * son los que se pueden precargar con la cuenta en foco; los otros 5 conceptos
 * (Cobrar trabajo, Pago de préstamo, Pago de gasto, Jornada, Tarea) se lanzan
 * desde su contexto.
 *
 * 🧹 **2026-10-02**: el popup perdió el ítem **"Ver todos los tipos"** (pedido del
 * usuario) y sumó una **cruz de cierre** flotante arriba a la derecha, porque va
 * **sin encabezado** (§113). ⚠️ Con eso la pantalla `/movimientos` (el listado
 * completo de tipos) **queda sin punto de entrada** en la app; sigue existiendo y
 * también es el `redirect` de `nuevo/[tipo]` cuando el concepto no existe.
 *
 * ⚠️ No es el único camino: el **long press** sobre la tarjeta de la cuenta sigue
 * abriendo el popup de acciones (`AccountActionsSheet`) con la misma cuenta.
 *
 * 🔑 **La prop `visible` lo oculta** (2026-10-02): en Inicio, cuando la tarjeta en
 * foco es la de **Balance** no hay ninguna acción de registro que hacer (no hay
 * cuenta con la que precargar el wizard), así que ese caso lo cubre el otro FAB
 * de Inicio, **`FabCuentas`** (gestionar cuentas).
 */
export function FabNuevo({
  cuentaId,
  visible = true,
}: {
  cuentaId?: number;
  /** ¿Se muestra? Con `false` queda transparente, inerte y fuera del foco. */
  visible?: boolean;
}) {
  const router = useRouter();
  const prefetch = usePrefetchNav();
  const [open, setOpen] = useState(false);

  const acciones = accionesNuevoMovimiento(cuentaId);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-fab-nuevo=""
        aria-label="Nuevo movimiento"
        title="Nuevo movimiento"
        // Oculto = transparente + inerte (no clickeable ni alcanzable por teclado).
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
        className={claseFab(visible)}
        style={ESTILO_FAB}
      >
        <span className="text-[26px] font-light leading-none">+</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} centrado>
        {/* Cruz de cierre arriba a la derecha (2026-10-02): el popup va **sin
            encabezado** (§113), así que el cierre vive flotando en la esquina. */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar"
          title="Cerrar"
          className="absolute right-2 top-2 rounded-lg p-2 text-subtitle transition-colors hover:bg-muted hover:text-header"
        >
          <X className="h-4 w-4" />
        </button>

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
        </div>
      </Modal>
    </>
  );
}

/**
 * **FAB "Gestionar cuentas"** (2026-10-02, §212.h.2) — el FAB de la tarjeta
 * **Balance Actual** del carrusel de Inicio.
 *
 * Decisión del usuario: esa tarjeta no tiene una acción de *registro* que ofrecer
 * (no hay cuenta con la que precargar el wizard), pero **sí** tiene la acción
 * natural del balance: **gestionar las cuentas** que lo componen ⇒ navega al CRUD
 * de cuentas, la misma ruta y el mismo icono que el ítem del menú ⋯ del panel
 * "Cuentas" (`?origen=dashboard`, para que el "volver" del CRUD regrese acá).
 *
 * Va con **`<Link>`** (no `onClick` + `router.push`): es una navegación en mobile
 * y la regla de la app es `<Link>` —además prefetchea el CRUD—. Los dos FAB de
 * Inicio comparten `claseFab`/`ESTILO_FAB` y se cruzan con un fade.
 */
export function FabCuentas({ visible = true }: { visible?: boolean }) {
  return (
    <Link
      href={HREF_CUENTAS}
      data-fab-cuentas=""
      aria-label="Gestionar cuentas"
      title="Gestionar cuentas"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={claseFab(visible)}
      style={ESTILO_FAB}
    >
      <Settings2 className="h-6 w-6" />
    </Link>
  );
}
