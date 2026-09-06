// Helpers puros de INGRESOS del dashboard (2026-09-05, §8 del plan).
// Reutilizables desde SSR (dashboard-data.ts) y desde el cliente
// (dashboard-client.tsx). No dependen de react ni de server.
//
// Un período aporta según la modalidad/estado:
//  - Con JORNADAS → se cuenta lo real por fecha de jornada (montoJornada+propina).
//  - Con TAREAS   → se cuenta lo real por FECHA LOCAL de la tarea
//    (`fechaTarea`, la que eligió el usuario; decisión 2026-09-05).
//  - Sin hijos y trabajo fijo/horas_fijas → se PRORRATEA el montoACobrar.
//  - Otros (sin hijos, horas_variables/por_tarea) → 0.
import type { PeriodoTrabajoOut } from "@/backend/src/queries/trabajos";

const SIN_TRABAJO = "Sin trabajo";

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" de un valor de fecha/hora (columnas date → UTC; tareas timestamptz → UTC). */
function ymd(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function diffDias(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000
  );
}

function finDeMesISO(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${ym}-${pad(ultimo)}`;
}

function ymDeFecha(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

function mesSiguiente(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + 1);
  return ymDeFecha(d);
}

function esProrrateo(p: PeriodoTrabajoOut): boolean {
  const m = p.trabajo?.modalidadCobro ?? "horas_variables";
  return (
    (m === "fijo" || m === "horas_fijas") &&
    !(p.jornadas?.length) &&
    !(p.tareas?.length)
  );
}

/** Aporte prorrateado del período [desdeP, hastaP] a la ventana [desde, hasta]. */
function montoProrrateado(
  desdeP: string,
  hastaP: string,
  monto: number,
  desde?: string,
  hasta?: string
): number {
  if (!monto || monto <= 0 || !desdeP || !hastaP) return 0;
  const ini = desde && desde > desdeP ? desde : desdeP;
  const fin = hasta && hasta < hastaP ? hasta : hastaP;
  if (ini > fin) return 0;
  const totalDias = diffDias(desdeP, hastaP) + 1;
  if (totalDias <= 0) return 0;
  const dias = diffDias(ini, fin) + 1;
  return (monto * dias) / totalDias;
}

/**
 * Ingresos de los períodos dados que caen en [desde, hasta] (fechas inclusive,
 * "YYYY-MM-DD"; sin fechas = todo). Devuelve total y el detalle por trabajo.
 */
export function ingresosEnRango(
  periodos: PeriodoTrabajoOut[],
  desde?: string,
  hasta?: string
): { total: number; porTrabajo: Map<string, number> } {
  const porTrabajo = new Map<string, number>();
  let total = 0;
  const add = (k: string, v: number) => {
    if (v > 0) {
      total += v;
      porTrabajo.set(k, (porTrabajo.get(k) || 0) + v);
    }
  };

  for (const p of periodos) {
    const nombre = p.trabajo?.nombre || SIN_TRABAJO;
    const jornadas = p.jornadas ?? [];
    const tareas = p.tareas ?? [];
    if (jornadas.length > 0) {
      for (const j of jornadas) {
        const f = ymd(j.fechaJornada);
        if ((desde && f < desde) || (hasta && f > hasta)) continue;
        add(nombre, (j.montoJornada || 0) + (j.montoPropina || 0));
      }
    } else if (tareas.length > 0) {
      for (const t of tareas) {
        // Fecha LOCAL de la tarea (fechaTarea, `date`): la eligió el usuario.
        const f = ymd(t.fechaTarea);
        if ((desde && f < desde) || (hasta && f > hasta)) continue;
        add(nombre, t.montoTarea || 0);
      }
    } else if (esProrrateo(p)) {
      add(
        nombre,
        montoProrrateado(
          ymd(p.fechaDesde),
          ymd(p.fechaHasta),
          p.montoACobrar ?? 0,
          desde,
          hasta
        )
      );
    }
  }
  return { total, porTrabajo };
}

/**
 * Total de ingresos del "mes actual" (badge): jornadas/tareas con fecha en
 * [1°, hoy] (los ítems no existen en el futuro) y prorrateo de fijo/horas_fijas
 * "a la fecha": solo los días del tramo del período dentro del mes que ya
 * transcurrieron hasta HOY (decisión usuario 2026-09-05). Ej.: período mensual
 * y hoy = día 10 → 10/30 del monto.
 */
export function ingresosDelMesActual(
  periodos: PeriodoTrabajoOut[],
  hoyISO: string
): number {
  const [y, m] = hoyISO.split("-").map(Number);
  const ym = `${y}-${pad(m)}`;
  const desde = `${ym}-01`;
  const hoy = hoyISO;
  let total = 0;

  for (const p of periodos) {
    const jornadas = p.jornadas ?? [];
    const tareas = p.tareas ?? [];
    if (jornadas.length > 0) {
      for (const j of jornadas) {
        const f = ymd(j.fechaJornada);
        if (f >= desde && f <= hoy) total += (j.montoJornada || 0) + (j.montoPropina || 0);
      }
    } else if (tareas.length > 0) {
      for (const t of tareas) {
        const f = ymd(t.fechaTarea);
        if (f >= desde && f <= hoy) total += t.montoTarea || 0;
      }
    } else if (esProrrateo(p)) {
      // fijo y horas_fijas: aporte "a la fecha" del mes actual = monto del
      // período × (días del tramo dentro del mes transcurridos hasta hoy /
      // días totales del período). NO se usa el mes completo (2026-09-05).
      total += montoProrrateado(
        ymd(p.fechaDesde),
        ymd(p.fechaHasta),
        p.montoACobrar ?? 0,
        desde,
        hoy
      );
    }
  }
  return total;
}

/**
 * Evolución de ingresos por mes (histórico) de los períodos dados: jornadas y
 * tareas por mes de su fecha; fijo/horas_fijas sin hijos prorrateado por mes.
 * Devuelve [{ name: "sep-2026", value }] ordenado cronológicamente (mismo
 * formato de etiqueta que el resto del dashboard).
 */
export function evolucionIngresosPorMes(
  periodos: PeriodoTrabajoOut[],
  hoy?: string
): { name: string; value: number }[] {
  const map = new Map<string, number>();
  const add = (ym: string, v: number) => {
    if (v > 0) map.set(ym, (map.get(ym) || 0) + v);
  };
  const sumarJornada = (j: PeriodoTrabajoOut["jornadas"][number]) => {
    const d = new Date(j.fechaJornada);
    d.setUTCHours(12, 0, 0, 0);
    add(ymDeFecha(d), (j.montoJornada || 0) + (j.montoPropina || 0));
  };
  const sumarTarea = (t: PeriodoTrabajoOut["tareas"][number]) => {
    // Fecha LOCAL (fechaTarea, `date`): mediodía UTC evita correrse de mes.
    const d = new Date(t.fechaTarea);
    d.setUTCHours(12, 0, 0, 0);
    add(ymDeFecha(d), t.montoTarea || 0);
  };

  for (const p of periodos) {
    const jornadas = p.jornadas ?? [];
    const tareas = p.tareas ?? [];
    if (jornadas.length > 0) {
      jornadas.forEach(sumarJornada);
    } else if (tareas.length > 0) {
      tareas.forEach(sumarTarea);
    } else if (esProrrateo(p)) {
      const monto = p.montoACobrar ?? 0;
      if (monto <= 0) continue;
      // fijo/horas_fijas: el mes EN CURSO se corta a HOY (a la fecha); los meses
      // cerrados van completos.
      const hoyYM = hoy ? hoy.slice(0, 7) : "";
      const desdeP = ymd(p.fechaDesde);
      const hastaP = ymd(p.fechaHasta);
      let cursor = ymDeFecha(new Date(p.fechaDesde));
      const hastaYM = ymDeFecha(new Date(p.fechaHasta));
      while (cursor <= hastaYM) {
        const finMes = finDeMesISO(cursor);
        const hasta = hoy && cursor === hoyYM ? (hoy < finMes ? hoy : finMes) : finMes;
        add(
          cursor,
          montoProrrateado(desdeP, hastaP, monto, `${cursor}-01`, hasta)
        );
        cursor = mesSiguiente(cursor);
      }
    }
  }

  return [...map.keys()]
    .sort()
    .map((ym) => {
      const [y, m] = ym.split("-").map(Number);
      const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("es-ES", {
        month: "short",
      });
      return { name: `${label}-${y}`, value: map.get(ym) || 0 };
    });
}
