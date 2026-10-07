/**
 * Helpers **compartidos** por los parsers de OCR — plan
 * `DeepSeek/plan-ocr-tickets.md` §11.2.
 *
 * Vive acá (y no dentro de un parser) para que un documento nuevo —hoy el
 * **ticket de compra**, mañana otro— reutilice la normalización y la búsqueda de
 * fecha en vez de duplicarlas.
 *
 * Es **puro** (no toca DOM ni red) y recibe `hoy` por parámetro ⇒ se puede probar
 * en Node sin navegador.
 */

/** Minúsculas, sin acentos y con espacios simples: base de toda comparación. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Fecha
// ─────────────────────────────────────────────────────────────────────────────

/** Meses por nombre completo y por abreviatura (español e inglés). */
const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  jan: 1, apr: 4, aug: 8, dec: 12, sept: 9,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
};

/**
 * Busca el mes **sólo por nombre conocido**.
 *
 * ⚠️ Antes había un fallback a las 3 primeras letras y era un bug: "marca",
 * "mayor" y "margen" se leían como "mar" (marzo) y generaban fechas fantasma.
 * Las abreviaturas (`oct`, `sept`) ya están en el mapa por sí solas.
 */
function mesDe(palabra: string): number | undefined {
  return MESES[palabra];
}

/** `true` si el recorte no arranca ni termina pegado a otro número o separador. */
function bordeValido(texto: string, inicio: number, fin: number): boolean {
  const anterior = texto[inicio - 1] ?? " ";
  const siguiente = texto[fin] ?? " ";
  return !/[\d./-]/.test(anterior) && !/\d/.test(siguiente);
}

/**
 * `true` si el candidato está **encadenado a otro número por los dos lados**
 * (`01-9-09` dentro de `1-01-9-09-004673`): eso es un código o un teléfono, no
 * una fecha.
 *
 * ⚠️ Se exige que esté pegado **a los dos lados** a propósito: un rango de fechas
 * escrito sin espacios (`05/10/26-06/10/26`) está pegado de un solo lado y sigue
 * siendo válido.
 */
function encadenadoPorAmbosLados(
  texto: string,
  inicio: number,
  largo: number
): boolean {
  const encadenado = (separador?: string, digito?: string) =>
    separador !== undefined &&
    digito !== undefined &&
    /[./-]/.test(separador) &&
    /\d/.test(digito);
  return (
    encadenado(texto[inicio - 1], texto[inicio - 2]) &&
    encadenado(texto[inicio + largo], texto[inicio + largo + 1])
  );
}

/** Arma `YYYY-MM-DD` validando de verdad el calendario (rechaza 31/02). */
function aISO(anio: number, mes: number, dia: number): string | undefined {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return undefined;
  const y = anio < 100 ? 2000 + anio : anio;
  if (y < 2000 || y > 2100) return undefined;
  const fecha = new Date(y, mes - 1, dia);
  if (fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return undefined;
  return `${y}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Todas las fechas plausibles del texto, en cualquier formato habitual. */
function fechasCandidatas(texto: string): string[] {
  const salida: string[] = [];
  const sumar = (iso: string | undefined) => {
    if (iso) salida.push(iso);
  };

  // ISO: 2026-10-05
  for (const m of texto.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    if (encadenadoPorAmbosLados(texto, m.index ?? 0, m[0].length)) continue;
    sumar(aISO(Number(m[1]), Number(m[2]), Number(m[3])));
  }
  // Numérica de 3 grupos: 05/10/26 · 5-10-2026 · 05.10.2026
  //
  // ⚠️ Si los dos primeros grupos son ≤ 12 el orden es **ambiguo** (día/mes o
  // mes/día según el país) y decide el paso de "fecha más cercana a hoy", como se
  // midió en el parte de EE.UU. del 2026-10-07 (`10/03/2026` es el 3 de octubre).
  //
  // 🔴 Se prueban **las dos lecturas siempre** y `aISO` descarta la imposible.
  // Antes la lectura "mes primero" sólo se emitía **si los dos grupos eran ≤ 12**,
  // así que un recibo de EE.UU. con el día > 12 (`09/13/26`) no producía
  // **ninguna** fecha: el único candidato era una fecha inventada de un código de
  // tique (`1-01-9-09-004673` → 2009-09-01) y esa ganaba.
  for (const m of texto.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g)) {
    if (encadenadoPorAmbosLados(texto, m.index ?? 0, m[0].length)) continue;
    const primero = Number(m[1]);
    const segundo = Number(m[2]);
    const anio = Number(m[3]);
    sumar(aISO(anio, segundo, primero)); // día primero
    if (primero !== segundo) sumar(aISO(anio, primero, segundo)); // mes primero
  }
  // Mes textual: "5 de octubre de 2026" · "5 oct 26" · "october 5, 2026"
  // ⚠️ `bordeValido` evita que el número salga del medio de otro ("2026" → "26"):
  // sin eso, "…2026 marca 10:15" inventaba la fecha 2010-03-26.
  for (const m of texto.matchAll(/(\d{1,2})\s*(?:de\s+)?([a-z]{3,})\.?\s*(?:de\s+|,?\s*)(\d{2,4})(?![\d:])/g)) {
    const mes = mesDe(m[2]);
    if (!mes) continue;
    const inicio = m.index ?? 0;
    if (!bordeValido(texto, inicio, inicio + m[0].length)) continue;
    sumar(aISO(Number(m[3]), mes, Number(m[1])));
  }
  for (const m of texto.matchAll(/\b([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{2,4})(?![\d:])/g)) {
    const mes = mesDe(m[1]);
    if (!mes) continue;
    const inicio = m.index ?? 0;
    if (!bordeValido(texto, inicio, inicio + m[0].length)) continue;
    sumar(aISO(Number(m[3]), mes, Number(m[2])));
  }

  return [...new Set(salida)];
}

/** Una alternativa a más de estos días de distancia ya no compite: elegir es seguro. */
const DIAS_ALTERNATIVA = 60;

/**
 * Elige la fecha **más cercana a hoy**: el documento (parte o ticket) suele ser
 * del día (o de estos días), y así se descartan fechas viejas impresas en él.
 *
 * Es también lo que resuelve la **ambigüedad día/mes** (`10/03/2026`): de las dos
 * lecturas posibles gana la que cae cerca de hoy.
 */
export function buscarFecha(
  texto: string,
  hoy: Date
): { fecha?: string; avisos: string[] } {
  const candidatas = fechasCandidatas(texto);
  if (candidatas.length === 0) return { avisos: [] };

  const distancia = (iso: string) =>
    Math.abs(new Date(`${iso}T12:00:00`).getTime() - hoy.getTime());
  const ordenadas = [...candidatas].sort((a, b) => distancia(a) - distancia(b));
  const elegida = ordenadas[0];

  // El aviso sólo importa si había OTRA fecha igual de plausible (ahí la elección
  // pudo ser discutible); si las demás están lejos, alarmar sería ruido.
  const limite = DIAS_ALTERNATIVA * 24 * 60 * 60 * 1000;
  const competidoras = ordenadas.slice(1).filter((iso) => distancia(iso) <= limite);

  return {
    fecha: elegida,
    avisos:
      competidoras.length > 0
        ? [`${candidatas.length} fechas en el texto: se eligió la más cercana a hoy (${elegida})`]
        : [],
  };
}
