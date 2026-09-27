/**
 * Horas **habladas** → `"HH:MM"` (formato del `TimeField` del wizard).
 *
 * Es el tipo que **faltaba** (`hueco 1` del relevamiento de los flujos de carga,
 * bitácora §164): la jornada y la tarea tienen campos de hora y el parser no tenía
 * cómo llenarlos. Reconoce:
 *
 * - `9:30` · `13.30` (literal)
 * - `a las 9` · `las 9` · `desde las 9` · `hasta las 17`
 * - `17 hs` · `9 h` · `9 am` · `9 pm`
 * - `de 9 a 17` · `desde 9 hasta 17` (rango ⇒ **dos** horas, en orden)
 * - `9 y media` (09:30) · `9 y cuarto` (09:15) · `9 en punto`
 * - `9 de la mañana` · `3 de la tarde` (⇒ 15:00) · `mediodía` / `medianoche`
 *
 * 🔑 **Reglas para no confundir horas con montos**:
 * 1. Un número **suelto** NUNCA es una hora (si no, "cargué 500" daría 05:00):
 *    hace falta un indicador ("a las", "las"…), un sufijo (`hs`) o formar un
 *    **rango** con otro número.
 * 2. `N horas` **no** es una hora (es una duración: el campo `horasTarea`).
 * 3. La hora se devuelve **como se dijo**: "a las 3" ⇒ `03:00` (predecible). Sólo
 *    se suman 12 con un calificador explícito ("de la tarde", "de la noche", `pm`).
 *
 * ⚠️ Se ejecuta **antes** que el paso de números en `parse-campos.ts`: los tokens
 * que consume acá (incluidos los conectores "de/a/hasta/las") dejan de ser
 * candidatos a **monto** y no quedan en el sobrante del aviso.
 */

import { extraerNumeros, type NumeroDetectado } from "./numeros";
import { norm } from "./normalizar";

export interface HoraDetectada {
  /** `"HH:MM"` listo para el formulario. */
  hora: string;
  /** Índices (inclusive) del tramo que la produjo: se consumen al asignarla. */
  desde: number;
  hasta: number;
  /** El tramo tal cual se dijo (para el chip del dictado). */
  texto: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Indicadores que **preceden** a un número y lo vuelven una hora. */
const INDICADORES: string[][] = [
  ["a", "las"],
  ["a", "la"],
  ["desde", "las"],
  ["desde", "la"],
  ["hasta", "las"],
  ["hasta", "la"],
  ["las"],
  ["la"],
  ["desde"],
];

/** Sufijos que **siguen** a un número y lo vuelven una hora. */
const SUFIJOS = new Set(["hs", "h", "am", "pm"]);

/** Conectores que arman un **rango** ("de 9 a 17", "desde 9 hasta 17"). */
const CONECTORES = new Set(["a", "hasta"]);

/** Agregados de precisión que siguen a la hora ("y media"). */
const AGREGADOS: Record<string, number> = {
  media: 30,
  cuarto: 15,
};

/** Calificadores que suman 12 horas (3 de la tarde ⇒ 15:00). */
const TARDE = new Set(["tarde", "noche", "pm"]);

/** Palabras sueltas que son una hora por sí mismas. */
const PALABRAS: Record<string, string> = {
  mediodia: "12:00",
  medianoche: "00:00",
};

/** Hora válida para una hora del día (0..23) o para un rango (1..24). */
const esHoraDia = (n: number) => n >= 0 && n <= 23;

/** ¿Los tokens `[i, i+1, …]` son este indicador? (y hay un número después) */
function indicadorEn(nrm: string[], i: number, partes: string[]): boolean {
  return partes.every((p, k) => nrm[i + k] === p);
}

/**
 * ¿Después del número `i` viene un **calificador** que confirma que es una hora
 * ("3 **de la tarde**", "9 **pm**")? Los consume `push()` al armar el valor.
 */
function sufijoCalificador(nrm: string[], i: number): boolean {
  const s1 = nrm[i + 1] ?? "";
  if (TARDE.has(s1)) return true;
  return s1 === "de" && nrm[i + 2] === "la" && TARDE.has(nrm[i + 3] ?? "");
}

/** Índice del último token consumido por un número (los hablados ocupan varios). */
const finDe = (n: NumeroDetectado) => n.hasta;

export function extraerHoras(tokens: string[]): HoraDetectada[] {
  const nrm = tokens.map(norm);
  const out: HoraDetectada[] = [];
  /** Tokens ya usados por una hora (no se reutilizan en otra). */
  const usado = tokens.map(() => false);

  /** Arma la hora a partir del valor y el tramo de tokens. */
  const push = (
    valor: number,
    desde: number,
    hasta: number,
    minutos = 0,
    /** Tokens extra que también se consumen (`hasta` real del tramo). */
    hastaTramo = hasta
  ) => {
    let h = valor;
    if (!Number.isInteger(valor)) return; // "12 con 100" (=12.1) no es una hora
    if (h > 23) return; // "a las 30" no es una hora
    // Calificador pegado: "3 **de la tarde**" / "9 **pm**".
    const desdeSig = hasta + 1;
    let ultimo = hasta;
    if (nrm[desdeSig] === "de" && nrm[desdeSig + 1] === "la" && TARDE.has(nrm[desdeSig + 2] ?? "")) {
      if (h <= 11) h += 12;
      ultimo = desdeSig + 2;
    } else if (TARDE.has(nrm[desdeSig] ?? "")) {
      if (h <= 11) h += 12;
      ultimo = desdeSig;
    }
    // "y media" / "y cuarto" / "en punto".
    if (nrm[ultimo + 1] === "y" && AGREGADOS[nrm[ultimo + 2] ?? ""] !== undefined) {
      minutos = AGREGADOS[nrm[ultimo + 2]];
      ultimo += 2;
    } else if (nrm[ultimo + 1] === "en" && nrm[ultimo + 2] === "punto") {
      ultimo += 2;
    }
    const fin = Math.max(ultimo, hastaTramo);
    for (let k = desde; k <= fin; k++) usado[k] = true;
    out.push({
      hora: `${pad(h)}:${pad(minutos)}`,
      desde,
      hasta: fin,
      texto: tokens.slice(desde, fin + 1).join(" "),
    });
  };

  // ── 1) Literales `9:30` / `13.30` ──────────────────────────────────────────
  for (let i = 0; i < tokens.length; i++) {
    const m = nrm[i].match(/^(\d{1,2})[:.](\d{2})$/);
    if (!m) continue;
    const h = Number(m[1]);
    const mi = Number(m[2]);
    if (h <= 23 && mi <= 59) push(h, i, i, mi);
  }

  // ── 2) Palabras (`mediodía`) ───────────────────────────────────────────────
  for (let i = 0; i < tokens.length; i++) {
    const literal = PALABRAS[nrm[i]];
    if (!literal || usado[i]) continue;
    usado[i] = true;
    out.push({ hora: literal, desde: i, hasta: i, texto: tokens[i] });
  }

  // ── 3) Números con indicador, sufijo o rango ───────────────────────────────
  const numeros = extraerNumeros(tokens).sort((a, b) => a.desde - b.desde);
  for (let k = 0; k < numeros.length; k++) {
    const n = numeros[k];
    if (usado[n.desde]) continue;

    /** ¿Hay un indicador inmediatamente antes (1 o 2 tokens)? */
    let desde = n.desde;
    let indicado = false;
    for (const partes of INDICADORES) {
      const inicio = n.desde - partes.length;
      if (inicio >= 0 && !usado[inicio] && indicadorEn(nrm, inicio, partes)) {
        desde = inicio;
        indicado = true;
        break;
      }
    }
    // Sufijo (`17 hs`) o rango (`de 9 a 17`).
    const sig = nrm[finDe(n) + 1] ?? "";
    const sufijo = SUFIJOS.has(sig) || sufijoCalificador(nrm, finDe(n));
    const rangoSig =
      CONECTORES.has(sig) &&
      numeros[k + 1] !== undefined &&
      !usado[numeros[k + 1].desde] &&
      Number.isInteger(numeros[k + 1].valor) &&
      numeros[k + 1].valor > 0 &&
      numeros[k + 1].valor <= 24;

    if (!indicado && !sufijo && !rangoSig) continue;
    if (!esHoraDia(n.valor) || n.valor === 0) continue;

    if (rangoSig) {
      // "de 9 a 17": la primera hora se lleva también el conector, así el tramo
      // queda sin huecos y el sobrante no se queda con el "a".
      const n2 = numeros[k + 1];
      push(n.valor, desde, finDe(n), 0, finDe(n) + 1);
      push(n2.valor, n2.desde, finDe(n2));
      continue;
    }
    push(n.valor, desde, SUFIJOS.has(sig) ? finDe(n) + 1 : finDe(n));
  }

  // Orden estable por posición en la frase.
  return out.sort((a, b) => a.desde - b.desde);
}
