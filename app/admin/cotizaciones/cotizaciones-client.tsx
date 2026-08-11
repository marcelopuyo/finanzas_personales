"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { refrescarCotizacionAdmin } from "@/backend/src/actions/cotizaciones";
import type {
  CotizacionOut,
  MonedaOut,
} from "@/backend/src/queries/maestros";
import { cn, dateTimeToString } from "@/lib/utils";

const inputCls =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-[13px] text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

function formatearTasa(tasa: number): string {
  return Number(tasa).toLocaleString("es-AR", { maximumFractionDigits: 6 });
}

/**
 * Panel admin de Cotizaciones: sin entrada manual (decisión 2026-08-10).
 * Permite ver las cotizaciones almacenadas y, por par de monedas, "cerrar la
 * vigente + re-consultar a la API" para refrescar el valor.
 */
export default function CotizacionesClient({
  cotizaciones,
  monedas,
}: {
  cotizaciones: CotizacionOut[];
  monedas: MonedaOut[];
}) {
  const router = useRouter();
  const [origenId, setOrigenId] = useState<number>(monedas[0]?.id ?? 0);
  const [destinoId, setDestinoId] = useState<number>(monedas[1]?.id ?? 0);
  const [refrescando, setRefrescando] = useState(false);

  const origen = monedas.find((m) => m.id === origenId);
  const destino = monedas.find((m) => m.id === destinoId);

  async function handleRefrescar() {
    if (!origenId || !destinoId) return;
    setRefrescando(true);
    try {
      const r = await refrescarCotizacionAdmin({
        monedaOrigenId: origenId,
        monedaDestinoId: destinoId,
      });
      toast.success(
        `Cotización actualizada: 1 ${origen?.codigoISO} = ${formatearTasa(r.tasa)} ${destino?.codigoISO}`
      );
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRefrescando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight text-header">
          Cotizaciones
        </h1>
        <p className="mt-0.5 text-[13px] text-subtitle">
          Tasas de cambio entre monedas (fuente: API gratuita). Solo lectura;
          podés refrescar la cotización vigente de un par.
        </p>
      </div>

      {/* Refrescar un par */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-[14px] font-medium text-header">
          Refrescar cotización de un par
        </h2>
        <p className="mt-1 text-[12px] text-subtitle">
          Cierra la cotización vigente del par y vuelve a consultar a la API.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select
            value={origenId}
            onChange={(e) => setOrigenId(Number(e.target.value))}
            aria-label="Moneda origen"
            className={inputCls}
          >
            {monedas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} ({m.codigoISO})
              </option>
            ))}
          </select>
          <span className="hidden items-center px-1 text-[13px] text-subtitle sm:flex">
            →
          </span>
          <select
            value={destinoId}
            onChange={(e) => setDestinoId(Number(e.target.value))}
            aria-label="Moneda destino"
            className={inputCls}
          >
            {monedas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} ({m.codigoISO})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleRefrescar}
            disabled={refrescando || !origenId || !destinoId || origenId === destinoId}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", refrescando && "animate-spin")} />
            {refrescando ? "Consultando..." : "Refrescar"}
          </button>
        </div>
      </section>

      {/* Historial de cotizaciones guardadas */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-[14px] font-medium text-header">
          Cotizaciones almacenadas
        </h2>
        {cotizaciones.length === 0 ? (
          <p className="mt-3 text-[13px] text-subtitle">
            Todavía no hay cotizaciones guardadas. Usá el formulario de arriba
            para consultar la primera.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[12px] text-subtitle">
                  <th className="py-2 pr-3 font-medium">Par</th>
                  <th className="py-2 pr-3 font-medium">Tasa (1 origen)</th>
                  <th className="py-2 pr-3 font-medium">Desde</th>
                  <th className="py-2 font-medium">Hasta</th>
                </tr>
              </thead>
              <tbody>
                {cotizaciones.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3">
                      {c.monedaOrigen?.codigoISO} → {c.monedaDestino?.codigoISO}
                    </td>
                    <td className="py-2 pr-3 font-medium text-value">
                      {formatearTasa(c.cotizacion)} {c.monedaDestino?.codigoISO}
                    </td>
                    <td className="py-2 pr-3 text-card-foreground">
                      {dateTimeToString(c.fechaInicial)}
                    </td>
                    <td className="py-2">
                      {c.fechaFinal ? (
                        dateTimeToString(c.fechaFinal)
                      ) : (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                          Vigente
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
