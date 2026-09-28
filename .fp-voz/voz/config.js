"use strict";
/**
 * Ajustes del dictado por voz (Opción 1: Web Speech API, **sin costo**).
 *
 * ⚠️ Todo lo de `lib/voz/` es **puro y sin dependencias**: normaliza texto, saca
 * números y fechas, y llena campos de un formulario. **Nunca** guarda nada ni
 * llama al backend — el usuario es la última instancia que persiste
 * (ver `DeepSeek/plan-dictado-voz.md`, decisiones D1–D18).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_TOKENS_TEXTO = exports.RELLENO_INICIAL = exports.MAX_CANDIDATOS = exports.MARGEN_GANADOR = exports.UMBRAL_OPCION = exports.REINICIO_MS = exports.MAX_REINICIOS = exports.ESPERA_HABLA_MS = exports.MAX_DICTADO_MS = exports.SILENCIO_MS = exports.VOZ_LANG = void 0;
/** Idioma del reconocimiento. `es-AR` es lo que mejor matchea con la jerga local. */
exports.VOZ_LANG = "es-AR";
/** Silencio (ms) tras el cual la sesión se corta sola. */
exports.SILENCIO_MS = 1500;
/** Tope duro (ms) de una sesión de dictado, aunque el usuario siga hablando. */
exports.MAX_DICTADO_MS = 10000;
/**
 * Si en este tiempo (ms) no se escuchó nada, se corta con "no te escuché".
 *
 * ⚠️ Bajado de 8 s a 5 s el 2026-09-23: con el FAB global, una sesión que no
 * reconoce nada se sentía "muerta" (el usuario no sabía si estaba escuchando).
 * Con 5 s alcanza para arrancar a hablar sin quedar esperando de más.
 */
exports.ESPERA_HABLA_MS = 5000;
/** Cantidad máxima de reinicios de la sesión antes de abortar. */
exports.MAX_REINICIOS = 3;
/**
 * Espera (ms) antes de reabrir una sesión cortada sola. iOS necesita que el
 * micrófono se libere; reabrir enseguida deja la sesión muda.
 */
exports.REINICIO_MS = 300;
/** Puntaje mínimo (0..1) para aceptar un match difuso contra una opción. */
exports.UMBRAL_OPCION = 0.62;
/** Diferencia mínima con el segundo candidato para dar por ganador a uno. */
exports.MARGEN_GANADOR = 0.15;
/** Cuántos candidatos se ofrecen cuando hay ambigüedad. */
exports.MAX_CANDIDATOS = 3;
/**
 * Palabras que se ignoran **al principio** de la Descripción cuando el usuario no
 * dijo "descripción": evita que la descripción quede en "de en la" o en
 * "cargar gasto de".
 *
 * Incluye los verbos de la acción porque en un gasto nunca son parte del
 * concepto. El costo es que "Carga de combustible" queda como "Combustible"
 * (asumible: es la misma idea y la categoría suele resolverlo por sinónimo).
 */
exports.RELLENO_INICIAL = new Set([
    // Enlaces y muletillas
    "por",
    "favor",
    "che",
    "eh",
    "bueno",
    "un",
    "una",
    "unos",
    "unas",
    "de",
    "del",
    "en",
    "el",
    "la",
    "los",
    "las",
    "que",
    "y",
    "al",
    "a",
    "con",
    "mi",
    "mis",
    "me",
    "te",
    "nos",
    "lo",
    "le",
    "les",
    "se",
    "fue",
    // Verbos de la acción
    "gaste",
    "gasto",
    "gastos",
    "gastar",
    "cargar",
    "carga",
    "cargue",
    "ingresar",
    "ingresa",
    "ingreso",
    "registrar",
    "registra",
    "registro",
    "anotar",
    "anota",
    "anote",
    "agregar",
    "agrega",
    "agregue",
    "sumar",
    "suma",
    "sumale",
    "poner",
    "pone",
    "meter",
    "mete",
    "crear",
    "crea",
    "pagar",
    "paga",
    "pague",
    "pago",
    "comprar",
    "compre",
    "compra",
    "quiero",
    "queria",
    "necesito",
    "necesitaba",
]);
/**
 * Tope de palabras del texto libre para aceptarlo como Descripción. Una frase
 * larga que no matcheó nada ("no entiendo nada de esto") es ruido: se informa
 * como "sin ubicar" en vez de ensuciar el campo.
 */
exports.MAX_TOKENS_TEXTO = 5;
