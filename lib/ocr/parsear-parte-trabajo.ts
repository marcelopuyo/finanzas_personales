/**
 * Extracción de campos de un **parte de trabajo diario** (fecha + horario) desde
 * el texto crudo del OCR — **sin IA**: sólo regex y heurísticas
 * (plan `DeepSeek/plan-ocr-tickets.md` §5).
 *
 * Criterios de diseño:
 * - **Ante la duda, no completar**: es preferible dejar un campo vacío a llenarlo
 *   mal (el wizard ya avisa de solapes y el usuario revisa igual).
 * - Todo lo dudoso se reporta en `avisos`, para poder mostrarlo y depurar.
 * - Es **puro** (no toca DOM ni red) y acepta `hoy` por parámetro ⇒ se puede
 *   probar en Node sin navegador.
 */

export type TrabajoOpcion = { id: number; nombre: string };

export type CamposJornada = {
  /** `YYYY-MM-DD` (el formato que usa el wizard). */
  fecha?: string;
  /** `HH:MM`. */
  horaDesde?: string;
  /** `HH:MM`. */
  horaHasta?: string;
  idTrabajo?: number;
  trabajoDetectado?: string;
  avisos: string[];
};

export type OpcionesExtraccion = { hoy?: Date };

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
    sumar(aISO(Number(m[1]), Number(m[2]), Number(m[3])));
  }
  // Numérica de 3 grupos: 05/10/26 · 5-10-2026 · 05.10.2026
  //
  // ⚠️ Si los dos primeros grupos son ≤ 12 el orden es **ambiguo** (día/mes o
  // mes/día según el país): se emiten LAS DOS lecturas y decide el paso de
  // "fecha más cercana a hoy". Medido en un parte de EE.UU. el 2026-10-07:
  // `10/03/2026` es el 3 de octubre, no el 10 de marzo.
  for (const m of texto.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g)) {
    const primero = Number(m[1]);
    const segundo = Number(m[2]);
    const anio = Number(m[3]);
    sumar(aISO(anio, segundo, primero)); // día primero
    if (primero !== segundo && primero <= 12 && segundo <= 12) {
      sumar(aISO(anio, primero, segundo)); // mes primero
    }
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
 * Elige la fecha **más cercana a hoy**: un parte de trabajo suele ser del día (o
 * de estos días), y así se descartan fechas viejas impresas en el documento.
 *
 * Es también lo que resuelve la **ambigüedad día/mes** (`10/03/2026`): de las dos
 * lecturas posibles gana la que cae cerca de hoy.
 */
function buscarFecha(texto: string, hoy: Date): { fecha?: string; avisos: string[] } {
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

// ─────────────────────────────────────────────────────────────────────────────
// Horas
// ─────────────────────────────────────────────────────────────────────────────

type CandidatoHora = { hhmm: string; minutos: number; indice: number };

/** Convierte las confusiones típicas del OCR **sólo** dentro de una hora. */
function aDigito(caracter: string): string {
  if (caracter === "O" || caracter === "o") return "0";
  if (caracter === "I" || caracter === "l") return "1";
  return caracter;
}

/** `true` si la hora es una **duración** ("Hours this shift: 08:48"), no un horario. */
function pareceDuracion(texto: string, indice: number): boolean {
  const previo = texto.slice(Math.max(0, indice - 30), indice);
  return /\b(?:horas?|hours?|hrs?|total)\b[^\d:]{0,20}:[^\d]{0,6}$/.test(previo);
}

/** Sufijo `AM`/`PM` (con o sin puntos) pegado a una hora. */
const RX_MERIDIANO = /^\s*([ap])\.?\s?m\.?/;

/**
 * Horas con forma `H:MM` / `HH:MM` / `17h30`, incluyendo el **formato de 12 h**
 * con `AM`/`PM`.
 *
 * ⚠️ El separador **no incluye el punto** a propósito: `05.10.2026` (una fecha)
 * se leería como la hora 05:10.
 * ⚠️ Medido en un parte real (2026-10-07): sin `AM`/`PM`, `7:35 AM` y `4:23 PM`
 * quedaban como 07:35 y 04:23 ⇒ se descartaban por incoherentes.
 */
function candidatosHora(texto: string): CandidatoHora[] {
  const salida: CandidatoHora[] = [];
  const rx = /([0-9OoIl]{1,2})\s*[:hH]\s*([0-9OoIl]{2})(?!\d)/g;
  for (const m of texto.matchAll(rx)) {
    const indice = m.index ?? 0;
    if (pareceDuracion(texto, indice)) continue;

    let hh = Number([...m[1]].map(aDigito).join(""));
    const mm = Number([...m[2]].map(aDigito).join(""));
    if (hh > 23 || mm > 59) continue;

    const meridiano = RX_MERIDIANO.exec(texto.slice(indice + m[0].length));
    if (meridiano) {
      if (hh > 12) continue; // "13:00 PM" no existe
      const esPm = meridiano[1].toLowerCase() === "p";
      if (esPm && hh < 12) hh += 12;
      if (!esPm && hh === 12) hh = 0; // 12:30 AM = 00:30
    }

    salida.push({
      hhmm: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      minutos: hh * 60 + mm,
      indice,
    });
  }
  return salida;
}

function aMinutos(hhmm: string): number {
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
}

function aHora(minutos: number): string {
  const hh = Math.floor(minutos / 60) % 24;
  const mm = minutos % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Etiquetas que marcan una hora de entrada. */
const ETIQUETAS_DESDE = new Set([
  "entrada",
  "ingreso",
  "inicio",
  "inicia",
  "comienzo",
  "comienza",
  "desde",
  "start",
  "in",
]);

/** Todas las etiquetas juntas, para poder asignar por **precedencia**. */
const RX_ETIQUETA =
  /\b(entrada|ingreso|inicio|inicia|comienzo|comienza|desde|start|in|salida|egreso|fin|finaliza|termina|hasta|end|out)\b/g;

type Etiqueta = { esDesde: boolean; fin: number };

/**
 * Asigna cada hora a la **última etiqueta que la precede**.
 *
 * Buscar por proximidad (dentro de N caracteres) era un bug: en
 * `Entrada illegible  Salida 17:30` la hora de salida quedaba asignada también a
 * la entrada. Con precedencia, cada hora se asigna una sola vez y sin límite de
 * distancia (`Entrada 09:00 … 40 caracteres … Salida 17:00`).
 */
function horasPorEtiqueta(
  texto: string,
  candidatos: CandidatoHora[]
): { desde?: string; hasta?: string } {
  const etiquetas: Etiqueta[] = [];
  for (const m of texto.matchAll(RX_ETIQUETA)) {
    etiquetas.push({
      esDesde: ETIQUETAS_DESDE.has(m[1]),
      fin: (m.index ?? 0) + m[0].length,
    });
  }

  let desde: string | undefined;
  let hasta: string | undefined;
  for (const candidato of candidatos) {
    let previa: Etiqueta | undefined;
    for (const etiqueta of etiquetas) {
      if (etiqueta.fin <= candidato.indice) previa = etiqueta;
      else break;
    }
    if (!previa) continue;
    if (previa.esDesde) {
      if (!desde) desde = candidato.hhmm;
    } else if (!hasta) {
      hasta = candidato.hhmm;
    }
  }
  return { desde, hasta };
}

/** Rango compacto: "09:00 a 17:00", "09:00-17:00" (las horas ya tienen `:`). */
function buscarRango(
  texto: string,
  candidatos: CandidatoHora[]
): { desde: string; hasta: string } | undefined {
  for (let i = 0; i < candidatos.length - 1; i += 1) {
    const a = candidatos[i];
    const b = candidatos[i + 1];
    const entre = texto.slice(a.indice + 5, b.indice);
    if (entre.length <= 10 && /^\s*(a|al|to|-|–|—|hasta)\s*$/.test(entre)) {
      if (a.minutos < b.minutos) return { desde: a.hhmm, hasta: b.hhmm };
    }
  }
  return undefined;
}

/** Hora suelta (sin minutos) o `HH:MM` → normalizada, validando rangos. */
function horaSuelta(hh: string, mm: string | undefined): { hhmm: string; minutos: number } | undefined {
  const h = Number(hh);
  const m = mm ? Number(mm) : 0;
  if (h > 23 || m > 59) return undefined;
  return {
    hhmm: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    minutos: h * 60 + m,
  };
}

/**
 * Rangos escritos **sin `:`** en las horas ("de 9 a 17", "Horario: 8 a 16").
 *
 * Se exige la forma `de…a…` o una palabra de horario delante: si no, un `5-10`
 * de una fecha se leería como un rango.
 */
function buscarRangoSuelto(texto: string): { desde: string; hasta: string } | undefined {
  const formas = [
    /\bde\s+(\d{1,2})(?::(\d{2}))?\s*(?:a|al|hasta|-|–)\s*(\d{1,2})(?::(\d{2}))?\b/,
    /\b(?:horario|jornada|turno|horas?|hs)\b[^\d]{0,15}(\d{1,2})(?::(\d{2}))?\s*(?:a|al|hasta|-|–)\s*(\d{1,2})(?::(\d{2}))?\b/,
  ];
  for (const rx of formas) {
    const m = rx.exec(texto);
    if (!m) continue;
    const desde = horaSuelta(m[1], m[2]);
    const hasta = horaSuelta(m[3], m[4]);
    if (desde && hasta && desde.minutos < hasta.minutos) {
      return { desde: desde.hhmm, hasta: hasta.hhmm };
    }
  }
  return undefined;
}

function buscarHoras(texto: string): { desde?: string; hasta?: string; avisos: string[] } {
  const avisos: string[] = [];
  const candidatos = candidatosHora(texto);

  let desde: string | undefined;
  let hasta: string | undefined;

  // 1) Por etiqueta (Entrada/Salida), sin límite de separación.
  const porEtiqueta = horasPorEtiqueta(texto, candidatos);
  desde = porEtiqueta.desde;
  hasta = porEtiqueta.hasta;

  // 2) Rango con ":" en las horas.
  if (!desde && !hasta && candidatos.length >= 2) {
    const rango = buscarRango(texto, candidatos);
    if (rango) {
      desde = rango.desde;
      hasta = rango.hasta;
      avisos.push(`rango horario detectado: ${desde} a ${hasta}`);
    }
  }

  // 3) Rango sin ":" en las horas ("de 9 a 17").
  if (!desde && !hasta) {
    const rango = buscarRangoSuelto(texto);
    if (rango) {
      desde = rango.desde;
      hasta = rango.hasta;
      avisos.push(`rango horario detectado: ${desde} a ${hasta}`);
    }
  }

  if (!desde && !hasta && candidatos.length >= 2) {
    const ordenados = [...candidatos].sort((a, b) => a.minutos - b.minutos);
    desde = ordenados[0].hhmm;
    hasta = ordenados[ordenados.length - 1].hhmm;
    avisos.push("horas sin etiqueta: se tomaron la menor y la mayor");
  }

  // Parte en formato de 12 h **sin AM/PM legible**: si la salida quedó antes que
  // la entrada y es de mañana, se interpreta como PM (turno mañana→tarde, el caso
  // normal). Observado en un parte real el 2026-10-07.
  if (desde && hasta && aMinutos(desde) >= aMinutos(hasta)) {
    const minutosHasta = aMinutos(hasta);
    if (minutosHasta < 12 * 60) {
      hasta = aHora(minutosHasta + 12 * 60);
      avisos.push(`salida deducida como PM: ${hasta}`);
    }
  }
  if (desde && hasta && aMinutos(desde) >= aMinutos(hasta)) {
    avisos.push(`horas incoherentes (${desde} ≥ ${hasta}): se descartan`);
    return { avisos };
  }
  if (desde && !hasta) avisos.push("sólo se detectó la hora de entrada");
  if (!desde && hasta) avisos.push("sólo se detectó la hora de salida");

  return { desde, hasta, avisos };
}

// ─────────────────────────────────────────────────────────────────────────────
// Trabajo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Busca el trabajo por nombre. Primero la **coincidencia completa**; si no, la
 * palabra más significativa del nombre (≥ 4 letras, palabra entera). Gana la
 * coincidencia más larga, para que "Publix Market" no pierda contra "Publix".
 */
function buscarTrabajo(
  textoNormalizado: string,
  trabajos: TrabajoOpcion[]
): TrabajoOpcion | undefined {
  let mejor: TrabajoOpcion | undefined;
  let mejorPuntaje = 0;

  for (const trabajo of trabajos) {
    const nombre = normalizar(trabajo.nombre);
    if (!nombre) continue;

    if (textoNormalizado.includes(nombre) && nombre.length > mejorPuntaje) {
      mejor = trabajo;
      mejorPuntaje = nombre.length;
      continue;
    }

    for (const palabra of nombre.split(" ").filter((p) => p.length >= 4)) {
      const rx = new RegExp(`\\b${palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (rx.test(textoNormalizado) && palabra.length > mejorPuntaje) {
        mejor = trabajo;
        mejorPuntaje = palabra.length;
      }
    }
  }

  return mejor;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extracción completa
// ─────────────────────────────────────────────────────────────────────────────

/** Extrae lo que se pueda del texto del OCR, con los avisos de lo dudoso. */
export function extraerJornada(
  textoOcr: string,
  trabajos: TrabajoOpcion[],
  opciones: OpcionesExtraccion = {}
): CamposJornada {
  const hoy = opciones.hoy ?? new Date();
  const texto = normalizar(textoOcr);

  const { fecha, avisos: avisosFecha } = buscarFecha(texto, hoy);
  const { desde, hasta, avisos: avisosHoras } = buscarHoras(texto);
  const trabajo = buscarTrabajo(texto, trabajos);

  const avisos = [...avisosFecha, ...avisosHoras];
  if (!fecha) avisos.push("no se encontró ninguna fecha");
  if (!desde && !hasta) avisos.push("no se encontraron horas");
  if (!trabajo && trabajos.length > 0) avisos.push("no se reconoció el trabajo");

  return {
    fecha,
    horaDesde: desde,
    horaHasta: hasta,
    idTrabajo: trabajo?.id,
    trabajoDetectado: trabajo?.nombre,
    avisos,
  };
}
