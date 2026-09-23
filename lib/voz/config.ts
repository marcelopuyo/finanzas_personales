/**
 * Ajustes del dictado por voz (Opción 1: Web Speech API, **sin costo**).
 *
 * ⚠️ Todo lo de `lib/voz/` es **puro y sin dependencias**: normaliza texto, saca
 * números y fechas, y llena campos de un formulario. **Nunca** guarda nada ni
 * llama al backend — el usuario es la última instancia que persiste
 * (ver `DeepSeek/plan-dictado-voz.md`, decisiones D1–D18).
 */

/** Idioma del reconocimiento. `es-AR` es lo que mejor matchea con la jerga local. */
export const VOZ_LANG = "es-AR";

/** Silencio (ms) tras el cual la sesión se corta sola. */
export const SILENCIO_MS = 1500;

/** Tope duro (ms) de una sesión de dictado, aunque el usuario siga hablando. */
export const MAX_DICTADO_MS = 10_000;

/**
 * Si en este tiempo (ms) no se escuchó nada, se corta con "no te escuché".
 *
 * ⚠️ Bajado de 8 s a 5 s el 2026-09-23: con el FAB global, una sesión que no
 * reconoce nada se sentía "muerta" (el usuario no sabía si estaba escuchando).
 * Con 5 s alcanza para arrancar a hablar sin quedar esperando de más.
 */
export const ESPERA_HABLA_MS = 5_000;

/** Cantidad máxima de reinicios de la sesión antes de abortar. */
export const MAX_REINICIOS = 3;

/**
 * Espera (ms) antes de reabrir una sesión cortada sola. iOS necesita que el
 * micrófono se libere; reabrir enseguida deja la sesión muda.
 */
export const REINICIO_MS = 300;

/** Puntaje mínimo (0..1) para aceptar un match difuso contra una opción. */
export const UMBRAL_OPCION = 0.62;

/** Diferencia mínima con el segundo candidato para dar por ganador a uno. */
export const MARGEN_GANADOR = 0.15;

/** Cuántos candidatos se ofrecen cuando hay ambigüedad. */
export const MAX_CANDIDATOS = 3;

/**
 * Palabras que se ignoran **al principio** de la Descripción cuando el usuario no
 * dijo "descripción": evita que la descripción quede en "de en la" o en
 * "cargar gasto de".
 *
 * Incluye los verbos de la acción porque en un gasto nunca son parte del
 * concepto. El costo es que "Carga de combustible" queda como "Combustible"
 * (asumible: es la misma idea y la categoría suele resolverlo por sinónimo).
 */
export const RELLENO_INICIAL = new Set([
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
export const MAX_TOKENS_TEXTO = 5;
