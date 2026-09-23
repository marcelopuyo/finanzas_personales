import Link from "next/link";

/**
 * Respuesta de `/voz` cuando el texto dictado **no** coincide con ninguna
 * intención conocida. A propósito **no se navega**: se muestra lo que se
 * escuchó y un ejemplo (D9 del plan `DeepSeek/plan-dictado-voz.md`).
 */
export function SinIntencion({ texto }: { texto: string }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 pb-6">
      <h1 className="text-[15px] font-semibold text-header">
        No entendí qué querías hacer
      </h1>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="mb-1 text-[12px] text-subtitle">Escuché:</p>
        <p className="text-[13px] text-card-foreground">«{texto}»</p>
      </div>

      <p className="text-[13px] text-subtitle">
        Probá con algo como{" "}
        <span className="text-header">
          «necesito cargar un gasto de tres mil en el supermercado»
        </span>
        .
      </p>

      <Link
        href="/dashboard"
        className="inline-block rounded-md border border-border px-3 py-2 text-[13px] text-header"
      >
        Ir al resumen
      </Link>
    </div>
  );
}
