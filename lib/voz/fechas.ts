/**
 * Fechas habladas → `yyyy-mm-dd`.
 *
 * Reconoce: "hoy", "ayer", "anteayer", "mañana", días de la semana ("el lunes" =
 * el más reciente), "el 15", "15 de septiembre", "15/09" y "15/09/2026".
 *
 * ⚠️ Sin año se usa el **año en curso** (decisión simple y predecible para una
 * app de gastos, donde las fechas dictadas son casi siempre del mes en curso).
 */

import { norm } from "./normalizar";

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

/** 0 = domingo, igual que `Date.getDay()`. */
const DIAS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

export interface FechaDetectada {
  /** `yyyy-mm-dd` en fecha **local**. */
  fecha: string;
  desde: number;
  hasta: number;
  texto: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `Date` → `yyyy-mm-dd` usando las partes **locales** (nunca UTC). */
export function aISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** La fecha local de hoy (mismo criterio que `todayLocalISODate`). */
export function hoyISO(): string {
  return aISO(new Date());
}

/** "26" → 2026 · "1999" → 1999. */
function normalizarAnio(n: number): number {
  if (n >= 1000) return n;
  return n < 70 ? 2000 + n : 1900 + n;
}

/** Extrae todas las fechas de una lista de tokens (con índices, para consumirlos). */
export function extraerFechas(tokens: string[], hoy: string = hoyISO()): FechaDetectada[] {
  const out: FechaDetectada[] = [];
  const nrm = tokens.map(norm);
  // Mediodía local: evita que un cambio de horario corra el día.
  const base = new Date(`${hoy}T12:00:00`);

  const push = (fecha: string, desde: number, hasta: number) => {
    out.push({ fecha, desde, hasta, texto: tokens.slice(desde, hasta + 1).join(" ") });
  };
  const rel = (dias: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + dias);
    return aISO(d);
  };
  const partes = (dia: number, mes: number, anio: number) =>
    aISO(new Date(anio, mes - 1, dia));

  let i = 0;
  while (i < tokens.length) {
    const t = nrm[i];

    // ── Relativas ────────────────────────────────────────────────────────────
    if (t === "hoy") {
      push(hoy, i, i);
      i++;
      continue;
    }
    if (t === "ayer") {
      push(rel(-1), i, i);
      i++;
      continue;
    }
    if (t === "anteayer") {
      push(rel(-2), i, i);
      i++;
      continue;
    }
    if (t === "antes" && nrm[i + 1] === "de" && nrm[i + 2] === "ayer") {
      push(rel(-2), i, i + 2);
      i += 3;
      continue;
    }
    if (t === "mañana") {
      push(rel(1), i, i);
      i++;
      continue;
    }

    // ── dd/mm[/aaaa] ─────────────────────────────────────────────────────────
    const slash = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (slash) {
      const dia = Number(slash[1]);
      const mes = Number(slash[2]);
      if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
        const anio = slash[3] ? normalizarAnio(Number(slash[3])) : base.getFullYear();
        push(partes(dia, mes, anio), i, i);
        i++;
        continue;
      }
    }

    // ── [el] <n> de <mes> [de <año>] ─────────────────────────────────────────
    {
      const salto = nrm[i] === "el" ? 1 : 0;
      const diaTxt = nrm[i + salto];
      const idxDe = i + salto + 1;
      if (diaTxt && /^\d{1,2}$/.test(diaTxt) && nrm[idxDe] === "de") {
        const mes = MESES[nrm[idxDe + 1] ?? ""];
        if (mes) {
          let hasta = idxDe + 1;
          let anio = base.getFullYear();
          if (nrm[hasta + 1] === "de" && /^\d{2,4}$/.test(nrm[hasta + 2] ?? "")) {
            anio = normalizarAnio(Number(nrm[hasta + 2]));
            hasta += 2;
          }
          push(partes(Number(diaTxt), mes, anio), i, hasta);
          i = hasta + 1;
          continue;
        }
      }
    }

    // ── [el] <día de la semana> → el más reciente hacia atrás ────────────────
    {
      const salto = nrm[i] === "el" ? 1 : 0;
      const dia = DIAS[nrm[i + salto] ?? ""];
      if (dia !== undefined) {
        const atras = (base.getDay() - dia + 7) % 7;
        push(rel(-atras), i, i + salto);
        i = i + salto + 1;
        continue;
      }
    }

    // ── el <n> → día del mes en curso ────────────────────────────────────────
    if (t === "el" && /^\d{1,2}$/.test(nrm[i + 1] ?? "")) {
      const dia = Number(nrm[i + 1]);
      if (dia >= 1 && dia <= 31) {
        push(partes(dia, base.getMonth() + 1, base.getFullYear()), i, i + 1);
        i += 2;
        continue;
      }
    }

    i++;
  }

  return out;
}
