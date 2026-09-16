"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import {
  OPCIONES_GRACIA,
  escribirGraciaMs,
  etiquetaGracia,
} from "@/lib/app-lock-prefs";
import { cn } from "@/lib/utils";

/**
 * Ajuste del **bloqueo de la app** (Perfil): cuánto puede estar la app en segundo
 * plano antes de pedir biometría al volver.
 *
 * Solo aplica en el **celular** y en los equipos que tengan una passkey activada
 * (si no, bloquear sería dejar al usuario afuera): ver `components/auth/app-lock.tsx`.
 *
 * La preferencia se guarda en una COOKIE (`lib/app-lock-prefs.ts`) y el propio
 * bloqueo la lee en el momento de bloquear, así que el cambio rige al instante.
 */
export function AppLockSection({ graciaInicial }: { graciaInicial: number }) {
  const [gracia, setGracia] = useState(graciaInicial);

  function elegir(valor: number) {
    setGracia(valor);
    escribirGraciaMs(valor);
    toast.success(
      valor === 0
        ? "La app va a pedir biometría apenas vuelvas a ella"
        : `La app va a pedir biometría después de ${etiquetaGracia(valor).toLowerCase()} en segundo plano`
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-subtitle" />
        <h2 className="text-[14px] font-medium text-header">Bloqueo de la app</h2>
      </div>
      <p className="mt-1 text-[12px] text-subtitle">
        En el celular, volver a la app después de haberla dejado en segundo plano
        pide biometría (no alcanza con volver sola, como pasa normalmente). Elegí
        cuánto puede pasar antes de pedirla.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-1">
        {OPCIONES_GRACIA.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            onClick={() => elegir(opcion.valor)}
            className={cn(
              "rounded-md px-2 py-2 text-[13px] transition-colors",
              gracia === opcion.valor
                ? "bg-primary font-medium text-primary-foreground"
                : "text-card-foreground hover:bg-muted"
            )}
          >
            {opcion.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-subtitle">
        Se aplica en los dispositivos con biometría activada (arriba). En la
        computadora no se bloquea.
      </p>
    </section>
  );
}
