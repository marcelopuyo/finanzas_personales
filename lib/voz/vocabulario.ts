/**
 * **Diccionario de voz → alias del catálogo del usuario.**
 *
 * Une las dos puntas:
 * - el **diccionario de SISTEMA** (conceptos + jerga genérica: *tabaco* → `cig`,
 *   `pucho`, `cigarrillo`…), que es **igual para todos los usuarios**, y
 * - el **catálogo real del usuario** (`categoriaGasto`, `cuenta`…), que es suyo.
 *
 * 🔑 **El diccionario NO guarda nombres de categorías.** Guarda **conceptos** y
 * **jerga**. La traducción concepto → *tu* categoría se calcula acá, **en memoria**,
 * comparando la jerga contra **cada token de tus etiquetas**:
 *
 * ```
 * concepto "tabaco"  (alias: tabla, cig, pucho, cigarrillo…)
 *      ├─ etiqueta "Diario - Cig"   → token "cig"          ⇒ ✅ alias "cig"
 *      ├─ etiqueta "Cigarrillos"    → token "cigarrillos"  ⇒ ✅ alias "cigarrillo"
 *      └─ etiqueta "Vicios"         → (nada)               ⇒ ✗ se aprende con el uso
 * ```
 *
 * Por eso el mismo diccionario global sirve para usuarios con categorías
 * completamente distintas: **no depende de cómo se llame ninguna**.
 *
 * ⚠️ **Sinónimos vs alias**: los `sinonimos` de la config de una pantalla siguen
 * existiendo (0.95) pero deben apuntar a **etiquetas reales** o a **conceptos**;
 * esto (0.99) es lo que hace que el usuario no tenga que tocar el código.
 *
 * ℹ️ Módulo **puro**: no consulta la BD ni conoce React. Recibe las opciones y los
 * conceptos ya cargados (misma filosofía que el resto de `lib/voz/`).
 */

import { norm, tokenizar } from "./normalizar";
import { similitud } from "./opciones";
import type {
  AliasOpcion,
  AmbitoVoz,
  CampoDictable,
  ConceptoVoz,
  OpcionVoz,
  ResultadoDictado,
} from "./tipos";

// Los tipos del vocabulario viven en `tipos.ts` (evita un ciclo de imports).
export type { AliasOpcion, ConceptoVoz } from "./tipos";

/** Alias a **aprender** a partir de una corrección del usuario (vía B). */
export interface CorreccionDictado {
  ambito: AmbitoVoz;
  /** Lo que dijo el usuario y la voz interpretó mal. */
  termino: string;
  /** Id de la opción que el usuario **eligió al final**. */
  destinoValor: string;
  destinoEtiqueta: string;
}

/**
 * Alias más cortos que esto solo matchean por **igualdad exacta**: sin esto "mp"
 * (Mercado Pago) haría match difuso contra cualquier cosa parecida.
 */
const MIN_FUZZY = 4;

/**
 * Umbral de la punta **etiqueta**: más alto que el difuso normal (`UMBRAL_OPCION`
 * 0.62) porque acá se decide **identidad** (¿esta etiqueta *es* este concepto?), no
 * "de qué está hablando".
 *
 * 🔬 Medido en la auditoría del 2026-09-23 (catálogo real de DEV): con 0.62,
 * `comestibles` daba 0.636 contra la etiqueta `Combustible` y `tablet` 0.667 contra
 * el token `cable` de `Internet - Cable - Telefono` ⇒ dos categorías mal llenadas.
 * Con 0.75 los dos se descartan y **todos** los matches buenos quedan (son exactos
 * o por contención, ≥ 0.9).
 */
const UMBRAL_ETIQUETA = 0.75;

/** Una ventana comparable de la etiqueta, con su cantidad de palabras. */
interface Ventana {
  texto: string;
  tokens: number;
}

/**
 * Ventanas comparables de una etiqueta: la completa, cada palabra y cada par.
 *
 * ⚠️ La comparación después exige **la misma cantidad de palabras** de los dos
 * lados: si no, un alias de varias palabras ("caja de ahorro", "bienes
 * personales") matcheaba por contención contra una **sola** palabra de la etiqueta
 * ("caja", "personal") y llenaba la categoría equivocada.
 */
function ventanas(label: string): Ventana[] {
  const tokens = tokenizar(label).map(norm);
  if (!tokens.length) return [];
  const out: Ventana[] = [{ texto: tokens.join(" "), tokens: tokens.length }];
  for (const t of tokens) out.push({ texto: t, tokens: 1 });
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push({ texto: `${tokens[i]} ${tokens[i + 1]}`, tokens: 2 });
  }
  return out;
}

/**
 * **Capa aprendida**: pisa el mapa con lo que el usuario ya eligió alguna vez.
 *
 * Cada fila es `término → id de SU opción`, así que la resolución es determinista
 * (1 sola opción) y de **máxima prioridad** (0.99).
 *
 * ⚠️ **Destino huérfano**: si el id ya no está entre las opciones del campo (la
 * categoría se borró o es de otro catálogo), la fila **se ignora** — nunca se
 * inventa una opción que no existe.
 *
 * @param mapa se modifica **in place** (es el que ya devolvió `aliasDeCatalogo`).
 */
export function fusionarAprendidos(
  mapa: Map<string, AliasOpcion[]>,
  filas: readonly {
    ambito: string;
    terminoNorm: string;
    destinoValor: string;
  }[],
  opciones: OpcionVoz[],
  ambito: string
): Map<string, AliasOpcion[]> {
  for (const fila of filas) {
    if (fila.ambito !== ambito) continue;
    const opcion = opciones.find((o) => o.value === fila.destinoValor);
    if (!opcion) continue;
    mapa.set(fila.terminoNorm, [
      {
        valor: opcion.value,
        etiqueta: opcion.label,
        puntaje: 0.99,
        concepto: "aprendido",
      },
    ]);
  }
  return mapa;
}

/**
 * **Vía B — corrección silenciosa** (plan de G2, §7): compara lo que la voz
 * aplicó con el valor **final** del formulario.
 *
 * Aprende **solo** cuando:
 * - el campo es de **catálogo** (tiene `catalogo` y `opciones`),
 * - la voz lo había llenado por `alias`, `opcion` o `sinonimo`,
 * - el valor final es una **opción real** del campo, **distinta** de la aplicada,
 *   y no quedó **vacío** (regla: nunca se aprende de un campo vacío).
 *
 * ⚠️ No entra `historial`: ese completado ya se resuelve por sí mismo con el
 * último gasto de esa descripción.
 *
 * ℹ️ Es **pura**: recibe el resultado del dictado, los valores finales y un
 * resolutor de campos. La pantalla la llama al **confirmar/guardar**.
 */
export function correccionesDeDictado(
  resultado: ResultadoDictado,
  finales: Record<string, unknown>,
  campoDe: (nombre: string) => CampoDictable | undefined
): CorreccionDictado[] {
  const out: CorreccionDictado[] = [];

  for (const a of resultado.asignaciones) {
    if (a.origen !== "alias" && a.origen !== "opcion" && a.origen !== "sinonimo") {
      continue;
    }
    const campo = campoDe(a.campo);
    if (!campo?.catalogo) continue;
    const opciones = campo.opciones?.() ?? [];
    if (!opciones.length) continue;

    const final = finales[a.campo];
    if (final === undefined || final === null || final === "" || final === 0) {
      continue; // vacío ⇒ no se aprende
    }
    const opcion = opciones.find((o) => o.value === String(final));
    if (!opcion) continue; // no es una opción real
    if (String(final) === String(a.valor)) continue; // no cambió ⇒ no es corrección

    const termino = (a.texto ?? "").trim();
    if (termino.length < 2) continue;

    out.push({
      ambito: campo.catalogo,
      termino,
      destinoValor: opcion.value,
      destinoEtiqueta: opcion.label,
    });
  }

  return out;
}

/**
 * Construye el **mapa de alias** de un catálogo:
 * `término dictado → opciones del usuario que le corresponden`.
 *
 * Resuelve en **las dos direcciones**, siempre a través del concepto:
 *
 * 1. **Directa** — el término dictado es un token de la etiqueta del usuario
 *    (`"cig"` ⊂ `Diario - Cig`). Es precisa: el término solo apunta a esa opción.
 * 2. **Indirecta** — el término **no** está en ninguna etiqueta, pero pertenece a
 *    un concepto que **sí** encontró su categoría (`"super"` → concepto
 *    *alimentacion* → tu categoría `Alimentacion`). 🔑 Sin esta vía, el diccionario
 *    solo serviría a quien nombró sus categorías con las palabras del diccionario.
 *
 * - **1 sola opción** ⇒ resolución determinista.
 * - **varias opciones** ⇒ ambigüedad ⇒ la pantalla las ofrece como candidatos
 *   (ej.: "alquiler" contra `Alquiler` y `Alquiler Santa Fe`; "gas" contra las dos
 *   categorías de servicios). La primera elección **se aprende** (capa del usuario).
 * - **ninguna** ⇒ el término se ignora (y se aprende con el uso si hace falta).
 *
 * ⚠️ **Nunca inventa**: solo devuelve opciones que existen en `opciones`.
 */
export function aliasDeCatalogo(
  opciones: OpcionVoz[],
  conceptos: ConceptoVoz[]
): Map<string, AliasOpcion[]> {
  /** Término → opciones que lo matchearon **directamente** (token de la etiqueta). */
  const directas = new Map<string, Map<string, AliasOpcion>>();
  /** Concepto → opciones que **encontró** en este catálogo. */
  const porConcepto = new Map<string, Map<string, AliasOpcion>>();

  const agregar = (
    destino: Map<string, Map<string, AliasOpcion>>,
    clave: string,
    opcion: OpcionVoz,
    puntaje: number,
    concepto: string
  ) => {
    const bolsa = destino.get(clave) ?? new Map<string, AliasOpcion>();
    const previa = bolsa.get(opcion.value);
    if (!previa || puntaje > previa.puntaje) {
      bolsa.set(opcion.value, {
        valor: opcion.value,
        etiqueta: opcion.label,
        puntaje,
        concepto,
      });
    }
    destino.set(clave, bolsa);
  };

  for (const opcion of opciones) {
    const vs = ventanas(opcion.label);
    if (!vs.length) continue;

    for (const c of conceptos) {
      for (const bruto of c.alias) {
        const a = norm(bruto);
        if (!a) continue;

        const palabras = a.split(" ").filter(Boolean).length;
        const exacto = a.length < MIN_FUZZY;

        for (const v of vs) {
          if (v.tokens !== palabras) continue;
          const p = exacto ? (v.texto === a ? 1 : 0) : similitud(a, v.texto);
          if (p < UMBRAL_ETIQUETA) continue;
          agregar(directas, a, opcion, p, c.concepto);
          agregar(porConcepto, c.concepto, opcion, p, c.concepto);
        }
      }
    }
  }

  const mapa = new Map<string, AliasOpcion[]>();

  for (const c of conceptos) {
    const encontradas = porConcepto.get(c.concepto);
    /**
     * Solo se hereda la jerga si el concepto encontró **una sola** categoría.
     * Si encontró varias, el concepto es ambiguo para este usuario ("gas" puede ser
     * `Luz` **o** `Internet - Cable - Telefono`) y propagarlo mandaría la jerga a
     * todas: mejor **no adivinar** y dejar que se aprenda con el uso.
     * (La jerga que sí es un token literal de una etiqueta siempre es directa.)
     */
    const heredable = encontradas && encontradas.size === 1 ? encontradas : undefined;

    for (const bruto of c.alias) {
      const a = norm(bruto);
      if (!a) continue;

      const bolsa = directas.get(a) ?? heredable;
      if (!bolsa) continue;

      const lista = mapa.get(a) ?? [];
      for (const item of bolsa.values()) {
        if (!lista.some((x) => x.valor === item.valor)) lista.push(item);
      }
      mapa.set(a, lista);
    }
  }

  return mapa;
}
