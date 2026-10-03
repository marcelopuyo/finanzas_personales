"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { LinkNavStatus } from "@/components/ui/nav-progress";
import { cn } from "@/lib/utils";

/**
 * **Botón de acción en círculo + rótulo** (2026-10-02, banda de Inicio; se
 * compartió el 2026-10-03 con las acciones del panel de Ingresos).
 *
 * Anatomía: un círculo semitransparente con el icono y, debajo, el rótulo en dos
 * líneas como máximo. Nació para las acciones de las tarjetas del carrusel
 * (Gasto · Transferencia · Ajuste de cuenta · Cuentas) y desde el 2026-10-03 es
 * **el mismo estilo** que usan las acciones del circuito de trabajo (Cargar
 * jornada · Cargar tarea · Cobrar trabajo) al pie del mini-panel de Ingresos —
 * antes eran el FAB ➕ flotante de la esquina.
 *
 * 🔑 Es un `<Link>` (es navegación y en mobile conviene el `<a href>` nativo,
 *    lección §117/§118) con la barra de progreso global de feedback.
 * ⚠️ Ancho fijo (`w-[104px]`) para que los rótulos se acomoden igual en todas las
 *    pantallas y los botones queden alineados en fila.
 */
export function AccionCirculo({
  href,
  icon: Icon,
  label,
  onPrefetch,
  className,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Prefetch al primer contacto (opcional; el llamador lo arma con `usePrefetchNav`). */
  onPrefetch?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onPointerEnter={onPrefetch}
      onTouchStartCapture={onPrefetch}
      className={cn(
        "flex w-[104px] flex-col items-center gap-1 rounded-xl px-1 py-0.5",
        className
      )}
    >
      <span className="flex h-8.5 w-8.5 items-center justify-center rounded-full border border-border bg-card/60 text-value">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-center text-[9px] leading-[1.15] text-card-foreground">
        {label}
      </span>
      <LinkNavStatus />
    </Link>
  );
}
