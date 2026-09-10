// Helpers puros de AGRUPACIÓN del gráfico Histórico de Gastos del dashboard.
// Solo los usa el cliente (dashboard-client.tsx); no dependen de react ni de server.
//
// Reemplaza la agrupación por `gasto.periodo.nombre` (la entidad `periodo_gasto` dejará
// de existir) por buckets CALENDARIO según la FECHA DE PAGO (`fechaPago`) del gasto:
// Mensual, Quincenal, Semanal, Diario, Anual. Los gastos sin `fechaPago` (pendientes)
// quedan fuera (decisión 2026-09-09, plan-agrupacion-historico-gastos.md).
//
// NOTA (2026-09-10): el dashboard usa SIEMPRE `mensual` (mes calendario); el selector
// "Agrupación" se quitó del modal de Filtros de Gastos. El resto de las opciones se
// conservan acá por si se vuelven a exponer.
import type { GastoOut } from "@/backend/src/queries/gastos";

export type AgrupacionGasto =
  | "diario"
  | "semanal"
  | "quincenal"
  | "mensual"
  | "anual";

/** Opciones del dropdown "Agrupación" (el orden es el del selector). */
export const OPCIONES_AGRUPACION_GASTO: {
  value: AgrupacionGasto;
  label: string;
}[] = [
  { value: "mensual", label: "Mensual" },
  { value: "quincenal", label: "Quincenal" },
  { value: "semanal", label: "Semanal" },
  { value: "diario", label: "Diario" },
  { value: "anual", label: "Anual" },
];

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "YYYY-MM-DD" de un valor de fecha (`date` puede llegar como string o Date).
 * Se truncan los componentes directamente (sin tocar zonas horarias), igual que
 * `toDateKey` del dashboard.
 */
function ymd(v: string | Date | null | undefined): string {
  if (!v) return "";
  return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
}

/** Mes corto es-ES ("sep") para un mes 1-12. */
function mesCorto(m: number): string {
  return new Date(Date.UTC(2000, m - 1, 15)).toLocaleDateString("es-ES", {
    month: "short",
    timeZone: "UTC",
  });
}

/** "d mmm aaaa" ("07 sep 2026") de una fecha "YYYY-MM-DD". */
function etiquetaDia(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return `${d} ${mesCorto(m)} ${y}`;
}

/**
 * Lunes (fecha "YYYY-MM-DD") de la semana que contiene la fecha dada. Se usa
 * semántica UTC para que el cálculo de día de semana no se corra de día.
 */
function lunesDeLaSemana(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const diaSemana = dt.getUTCDay(); // 0 = domingo
  // Días hacia atrás hasta el lunes: domingo (-6), lunes (0), ... sábado (-5).
  dt.setUTCDate(dt.getUTCDate() + (diaSemana === 0 ? -6 : 1 - diaSemana));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(
    dt.getUTCDate()
  )}`;
}

/**
 * Agrupa gastos PAGADOS en buckets calendario según su `fechaPago` y devuelve
 * [{ name, value }] ORDENADO cronológicamente. Etiquetas consistentes con el
 * resto del dashboard (mensual → "sep-2026"; el resto con año para no
 * confundirse entre rangos largos).
 */
export function gastosEvolucionPor(
  gastos: Pick<GastoOut, "fechaPago" | "monto">[],
  agrupacion: AgrupacionGasto
): { name: string; value: number }[] {
  const valores = new Map<string, number>();
  const etiquetas = new Map<string, string>();

  for (const g of gastos) {
    const f = ymd(g.fechaPago);
    if (!f) continue; // Pendientes sin fechaPago quedan fuera (decisión D3).
    const [y, m, d] = f.split("-").map(Number);

    let key: string;
    let label: string;
    switch (agrupacion) {
      case "mensual":
        key = `${y}-${pad(m)}`;
        label = `${mesCorto(m)}-${y}`;
        break;
      case "quincenal": {
        const q = d <= 15 ? 1 : 2;
        key = `${y}-${pad(m)}-${q}`;
        label = `${mesCorto(m)} ${q === 1 ? "1ª" : "2ª"}`;
        break;
      }
      case "semanal": {
        const lunes = lunesDeLaSemana(f);
        key = lunes;
        label = etiquetaDia(lunes);
        break;
      }
      case "diario":
        key = f;
        label = etiquetaDia(f);
        break;
      case "anual":
        key = `${y}`;
        label = `${y}`;
        break;
    }

    valores.set(key, (valores.get(key) || 0) + (g.monto || 0));
    etiquetas.set(key, label);
  }

  return [...valores.keys()]
    .sort()
    .map((key) => ({
      name: etiquetas.get(key) || key,
      value: valores.get(key) || 0,
    }));
}
