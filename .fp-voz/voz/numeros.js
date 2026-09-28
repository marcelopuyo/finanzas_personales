"use strict";
/**
 * Números en español → `number`.
 *
 * Soporta: palabras ("tres mil quinientos"), dígitos ("3500", "$5.000",
 * "1200,50"), mixto ("3 mil") y decimales con conector ("mil doscientos con
 * cincuenta"). Convención es-AR: "." separa miles cuando el último grupo tiene
 * exactamente 3 dígitos; "," siempre es decimal.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.numeroDesdeDigitos = numeroDesdeDigitos;
exports.extraerNumeros = extraerNumeros;
exports.numeroMayor = numeroMayor;
const normalizar_1 = require("./normalizar");
const UNIDAD = {
    cero: 0,
    un: 1,
    uno: 1,
    una: 1,
    veintiun: 21,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
    once: 11,
    doce: 12,
    trece: 13,
    catorce: 14,
    quince: 15,
    dieciseis: 16,
    diecisiete: 17,
    dieciocho: 18,
    diecinueve: 19,
    veinte: 20,
    veintiuno: 21,
    veintidos: 22,
    veintitres: 23,
    veinticuatro: 24,
    veinticinco: 25,
    veintiseis: 26,
    veintisiete: 27,
    veintiocho: 28,
    veintinueve: 29,
};
const DECENA = {
    treinta: 30,
    cuarenta: 40,
    cincuenta: 50,
    sesenta: 60,
    setenta: 70,
    ochenta: 80,
    noventa: 90,
};
const CENTENA = {
    cien: 100,
    ciento: 100,
    doscientos: 200,
    trescientos: 300,
    cuatrocientos: 400,
    quinientos: 500,
    seiscientos: 600,
    setecientos: 700,
    ochocientos: 800,
    novecientos: 900,
};
/** Multiplicadores. */
const MULTIPLO = {
    mil: 1000,
    millon: 1000000,
    millones: 1000000,
};
/**
 * Jerga local (es-AR). Se puede vaciar sin tocar el resto del parser.
 * No incluye "palo" a propósito (demasiado coloquial/ambigua).
 */
const JERGA = {
    luca: 1000,
    lucas: 1000,
};
/**
 * Palabras que **solas** no alcanzan para ser un número: si no, "necesito cargar
 * un gasto" daría `monto = 1` por el "un".
 */
const DEBILES = new Set(["un", "uno", "una", "cero"]);
/** Conectores internos del número ("treinta y uno", "mil doscientos con 50"). */
const CONECTORES = new Set(["y"]);
/** Separadores de decimales. */
const DECIMALES = new Set(["con", "punto", "coma"]);
/** ¿Es un token con dígitos ("3500", "$5.000", "1,5")? */
function esDigito(t) {
    return /\d/.test(t);
}
/** ¿Es una palabra de número conocida? */
function esPalabra(t) {
    return (UNIDAD[t] !== undefined ||
        DECENA[t] !== undefined ||
        CENTENA[t] !== undefined ||
        MULTIPLO[t] !== undefined ||
        JERGA[t] !== undefined);
}
/** Un número válido necesita al menos una palabra "fuerte" (no `un`/`cero`). */
function esFuerte(t) {
    if (DEBILES.has(t))
        return false;
    return esPalabra(t) || esDigito(t);
}
/** Convierte un token con dígitos a número, con la convención es-AR. */
function numeroDesdeDigitos(t) {
    const s = t.replace(/[^\d.,]/g, "");
    if (!s)
        return null;
    const partes = s.split(/[.,]/);
    if (partes.length === 1)
        return Number(partes[0]);
    const ultimo = partes[partes.length - 1];
    // "3.500" → miles (el grupo final tiene 3 dígitos) · "1.200.000" → idem
    if (/^\d{3}$/.test(ultimo))
        return Number(partes.join(""));
    // "1200,50" / "1200.50" / "1.200,50" → el último separador es decimal
    return Number(`${partes.slice(0, -1).join("")}.${ultimo}`);
}
/** Valor de un token suelto (dígito o palabra, sin multiplicadores). */
function valorToken(t) {
    if (esDigito(t))
        return numeroDesdeDigitos(t);
    const v = UNIDAD[t] ?? DECENA[t] ?? CENTENA[t];
    return v === undefined ? null : v;
}
/** Evalúa una corrida de tokens como entero ("tres mil quinientos" → 3500). */
function evaluarEntero(palabras) {
    let total = 0;
    let actual = 0;
    let alguno = false;
    for (const w of palabras) {
        if (CONECTORES.has(w))
            continue;
        const mult = MULTIPLO[w] ?? JERGA[w];
        if (mult !== undefined) {
            total += (actual || 1) * mult;
            actual = 0;
            alguno = true;
            continue;
        }
        const v = valorToken(w);
        if (v === null)
            return null;
        actual += v;
        alguno = true;
    }
    return alguno ? total + actual : null;
}
/** Evalúa la corrida completa, resolviendo la parte decimal. */
function evaluarCorrida(palabras) {
    const idxDec = palabras.findIndex((w) => DECIMALES.has(w));
    if (idxDec === -1)
        return evaluarEntero(palabras);
    const entero = evaluarEntero(palabras.slice(0, idxDec));
    if (entero === null)
        return null;
    const decimales = palabras.slice(idxDec + 1);
    if (!decimales.length)
        return entero;
    const dv = evaluarEntero(decimales);
    if (dv === null)
        return entero;
    const texto = decimales.join("");
    const digitos = /^\d+$/.test(texto) ? texto.length : String(dv).length;
    return entero + dv / Math.pow(10, digitos);
}
/**
 * Extrae todos los números de una lista de tokens, devolviendo **índices** para
 * que el llamador pueda marcar esos tokens como consumidos.
 */
function extraerNumeros(tokens) {
    const nrm = tokens.map(normalizar_1.norm);
    const out = [];
    let i = 0;
    while (i < tokens.length) {
        if (!esPalabra(nrm[i]) && !esDigito(nrm[i])) {
            i++;
            continue;
        }
        let fin = i;
        let hayFuerte = esFuerte(nrm[i]);
        // Extiende la corrida: palabras/dígitos, y conectores solo si siguen con uno.
        while (fin + 1 < tokens.length) {
            const sig = nrm[fin + 1];
            if (esPalabra(sig) || esDigito(sig)) {
                fin++;
                if (esFuerte(sig))
                    hayFuerte = true;
                continue;
            }
            if (CONECTORES.has(sig) || DECIMALES.has(sig)) {
                const dsp = nrm[fin + 2];
                if (dsp !== undefined && (esPalabra(dsp) || esDigito(dsp))) {
                    fin += 2;
                    if (esFuerte(dsp))
                        hayFuerte = true;
                    continue;
                }
            }
            break;
        }
        if (hayFuerte) {
            const valor = evaluarCorrida(nrm.slice(i, fin + 1));
            if (valor !== null && Number.isFinite(valor)) {
                out.push({
                    valor,
                    desde: i,
                    hasta: fin,
                    texto: tokens.slice(i, fin + 1).join(" "),
                });
            }
        }
        i = fin + 1;
    }
    return out;
}
/** El número más grande de la lista (el que mejor pinta de "monto" tiene). */
function numeroMayor(numeros) {
    return numeros.reduce((mejor, n) => (!mejor || n.valor > mejor.valor ? n : mejor), undefined);
}
