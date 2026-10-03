"use client";

import { Scale } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * **Tarjeta "Balance Actual"** de Inicio (2026-10-02, rama `rediseno-ui`).
 *
 * Antes el balance era una **franja de una línea** arriba del carrusel. Ahora es
 * la **PRIMERA tarjeta del carrusel** (siempre la que se ve a la entrada, antes
 * que la primera cuenta) y comparte la anatomía de `AccountCard` —icono, rótulo
 * de 12px y monto de 18px— para que el carrusel se lea como una sola familia.
 *
 * 🔑 El **tratamiento diferente** (lo que la distingue de las tarjetas de cuenta,
 * sin romper la armonía) son 4 cosas y nada más:
 * 1. Fondo `bg-card` (las cuentas usan `bg-muted`, más oscuro).
 * 2. Borde `border-primary/45` en vez del gris `border-border`.
 * 3. Icono en `text-primary`.
 * 4. Un **halo** primario desenfocado en la esquina superior derecha.
 *
 * El monto va en `text-success` (es el total, igual que antes). **No** tiene
 * sparkline ni acciones: no navega ni abre bottom sheet, solo se selecciona.
 */
interface BalanceCardProps {
  /** Monto del balance **ya formateado** (moneda predeterminada del usuario). */
  balance: string;
  className?: string;
}

export function BalanceCard({ balance, className }: BalanceCardProps) {
  return (
    <div
      data-balance-card=""
      className={cn(
        "relative flex flex-col justify-start overflow-hidden rounded-2xl border border-primary/45 bg-card p-4 transition-colors",
        className
      )}
    >
      {/* Halo primario (decorativo, no intercepta toques). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-primary/25 blur-2xl"
      />
      {/* Misma anatomía que `AccountCard`: icono a la izquierda, rótulo + monto. */}
      <div className="relative flex items-start gap-2.5">
        <Scale className="h-4.5 w-4.5 flex-none text-primary" />
        <div className="min-w-0">
          <p className="text-[12px] leading-4 text-label">Balance Actual</p>
          <p className="mt-0.5 truncate text-[18px] leading-7 tracking-tight text-success">
            {balance}
          </p>
        </div>
      </div>
    </div>
  );
}
