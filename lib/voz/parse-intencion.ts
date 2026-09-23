/**
 * Parser de **intención**: ¿qué quiere hacer el usuario?
 *
 * Regla (D9 del plan): hace falta un **sustantivo** ("gasto") y, además, un
 * **verbo de acción** ("cargar", "anotar", "necesito"…) — o una frase muy corta,
 * que ya es suficientemente explícita ("un gasto"). Sin intención reconocida
 * **no se navega**: se le muestran ejemplos.
 */

import { INTENCIONES } from "./intenciones";
import { norm, tokenizar } from "./normalizar";
import type { Intencion, ResultadoIntencion } from "./tipos";

/** Frase corta: hasta esta cantidad de palabras alcanza el sustantivo solo. */
const MAX_SIN_VERBO = 3;

/** Enlaces que se comen al principio del texto sobrante ("de tres mil" → "tres mil"). */
const ENLACES = new Set(["de", "del", "un", "una", "unos", "unas", "para", "el", "la", "los", "las", "mi", "mis"]);

export function parsearIntencion(
  texto: string,
  intenciones: Intencion[] = INTENCIONES
): ResultadoIntencion {
  const orig = tokenizar(texto);
  const nrm = orig.map(norm);
  if (!orig.length) return { intencion: null, resto: "" };

  for (const intencion of intenciones) {
    const idxSust = nrm.findIndex((t) => intencion.sustantivos.includes(t));
    if (idxSust === -1) continue;

    const hayVerbo = nrm.some((t) => intencion.verbos.includes(t));
    if (!hayVerbo && orig.length > MAX_SIN_VERBO) continue;

    // Se descartan TODAS las palabras de la intención (no solo la primera):
    // "necesito ingresar un gasto" tiene dos verbos y ninguno va al destino.
    const usados = new Set<number>();
    nrm.forEach((t, i) => {
      if (intencion.sustantivos.includes(t) || intencion.verbos.includes(t)) usados.add(i);
    });

    const restantes = orig.filter((_, i) => !usados.has(i));
    // Se comen los enlaces iniciales (puede haber más de uno: "de un gasto").
    let k = 0;
    while (k < restantes.length && ENLACES.has(norm(restantes[k]))) k++;

    return { intencion, resto: restantes.slice(k).join(" ").trim() };
  }

  return { intencion: null, resto: "" };
}
