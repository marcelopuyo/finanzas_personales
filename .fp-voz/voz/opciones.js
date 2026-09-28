"use strict";
/**
 * Match difuso de texto dictado contra las opciones de un select/combobox.
 * **Sin dependencias**: comparación por igualdad, contención, bigramas (Dice) y
 * tokens compartidos. Se queda con la mejor de todas.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.similitud = similitud;
exports.buscarOpciones = buscarOpciones;
exports.buscarSinonimo = buscarSinonimo;
exports.buscarAlias = buscarAlias;
const normalizar_1 = require("./normalizar");
/** Bigramas de caracteres, sin espacios repetidos. */
function bigramas(s) {
    const t = s.replace(/\s+/g, " ").trim();
    const out = [];
    for (let i = 0; i < t.length - 1; i++)
        out.push(t.slice(i, i + 2));
    return out;
}
/** Similitud 0..1 entre dos textos (se esperan ya normalizados). */
function similitud(a, b) {
    if (!a || !b)
        return 0;
    if (a === b)
        return 1;
    const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];
    // Contención: "supermercado" dentro de "supermercado central".
    if (corto.length >= 4 && largo.includes(corto))
        return 0.9;
    // Dice sobre bigramas (tolera errores de tipeo/transcripción).
    const A = bigramas(a);
    const B = bigramas(b);
    if (!A.length || !B.length)
        return 0;
    const cuenta = new Map();
    for (const g of A)
        cuenta.set(g, (cuenta.get(g) ?? 0) + 1);
    let comunes = 0;
    for (const g of B) {
        const c = cuenta.get(g) ?? 0;
        if (c > 0) {
            comunes++;
            cuenta.set(g, c - 1);
        }
    }
    let mejor = (2 * comunes) / (A.length + B.length);
    // Tokens compartidos (por si uno tiene palabras extra).
    const ta = a.split(" ").filter(Boolean);
    const tb = b.split(" ").filter(Boolean);
    if (ta.length && tb.length) {
        const setB = new Set(tb);
        const comunesTokens = ta.filter((t) => setB.has(t)).length;
        mejor = Math.max(mejor, comunesTokens / Math.max(ta.length, tb.length));
    }
    return mejor;
}
/**
 * Puntúa todas las opciones contra el texto dictado. Se compara contra el texto
 * completo, contra cada palabra y contra cada par de palabras consecutivas: así
 * "gasté en el supermercado" encuentra la opción "Supermercado".
 *
 * Devuelve la lista **ordenada de mayor a menor** por puntaje.
 */
function buscarOpciones(texto, opciones) {
    const n = (0, normalizar_1.norm)(texto);
    if (!n)
        return [];
    const tokens = n.split(" ").filter(Boolean);
    const ventanas = [n, ...tokens];
    for (let i = 0; i < tokens.length - 1; i++) {
        ventanas.push(`${tokens[i]} ${tokens[i + 1]}`);
    }
    return opciones
        .map((opcion) => {
        const label = (0, normalizar_1.norm)(opcion.label);
        let mejor = 0;
        let termino = opcion.label;
        for (const v of ventanas) {
            const p = similitud(v, label);
            if (p > mejor) {
                mejor = p;
                termino = v;
            }
        }
        return { opcion, puntaje: mejor, termino };
    })
        .sort((a, b) => b.puntaje - a.puntaje);
}
/**
 * Sinónimos declarados en la config (`CampoDictable.sinonimos`): término dictado
 * → etiquetas de opción. Es determinista, así que gana sobre el match difuso.
 */
function buscarSinonimo(tokens, campo, opciones) {
    const mapa = campo.sinonimos;
    if (!mapa)
        return undefined;
    for (const t of tokens) {
        const etiquetas = mapa[t];
        if (!etiquetas)
            continue;
        const objetivo = etiquetas.map(normalizar_1.norm);
        const hit = opciones.find((o) => objetivo.includes((0, normalizar_1.norm)(o.label)));
        if (hit)
            return { opcion: hit, puntaje: 0.95, termino: t };
    }
    return undefined;
}
/**
 * **Vocabulario** (capa de sistema + lo aprendido): el término dictado ya viene
 * resuelto contra las opciones del usuario (`lib/voz/vocabulario.ts`), así que acá
 * solo hay que buscarlo en la frase.
 *
 * 🔑 Es la fuente **de mayor prioridad**: 0.99, por encima de los sinónimos del
 * código (0.95) y del match difuso (calculado).
 *
 * - **1 opción** ⇒ resolución determinista.
 * - **varias** ⇒ el llamador las ofrece como **candidatos** (elección → se aprende).
 *
 * ⚠️ Se prueban primero los **pares** de palabras ("mercado pago", "caja de
 * ahorro") y después las sueltas: lo más específico gana.
 */
function buscarAlias(tokens, alias) {
    if (!alias?.size || !tokens.length)
        return undefined;
    for (let i = 0; i < tokens.length - 1; i++) {
        const par = `${tokens[i]} ${tokens[i + 1]}`;
        const hit = alias.get(par);
        if (hit)
            return { termino: par, opciones: hit };
    }
    for (const t of tokens) {
        const hit = alias.get(t);
        if (hit)
            return { termino: t, opciones: hit };
    }
    return undefined;
}
