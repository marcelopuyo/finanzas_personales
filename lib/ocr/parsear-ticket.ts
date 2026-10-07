/**
 * Extracción de los campos de un **ticket de compra** desde el texto crudo del
 * OCR — **sin IA**: sólo regex y heurísticas
 * (plan `DeepSeek/plan-ocr-tickets.md` §11).
 *
 * Criterios de diseño (los mismos del parser del parte de trabajo):
 * - **Ante la duda, no completar**: es preferible dejar un campo vacío a llenarlo
 *   mal (el usuario revisa igual antes de guardar).
 * - Todo lo dudoso se reporta en `avisos`, para poder mostrarlo y depurar.
 * - Es **puro** (no toca DOM ni red) y acepta `hoy` por parámetro ⇒ se puede
 *   probar en Node sin navegador.
 *
 * Decisión de alcance: **no** se le piden `blocks`/`tsv` al motor para medir la
 * altura de caja de cada línea (`§11.2`): con el **texto plano** alcanza para el
 * comercio, y así el motor del escáner queda igual que el del parte. Si el QA con
 * tickets reales muestra que hace falta, se agrega.
 */
import { buscarFecha, normalizar } from "./comun";

export type CamposTicket = {
  /** `YYYY-MM-DD` (el formato que usa el wizard). */
  fecha?: string;
  /** **Total** del ticket, en la moneda del documento. */
  monto?: number;
  /** **Comercio** leído; va al campo Descripción del wizard. */
  descripcion?: string;
  avisos: string[];
};

export type OpcionesTicket = { hoy?: Date };

// ─────────────────────────────────────────────────────────────────────────────
// Importes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Importe ya **aislado del texto**: agrupado (`1.234,56` / `1,234.56` / `1.234`),
 * con decimales (`12,50` / `12.50`) o entero (`1234`).
 *
 * ⚠️ El separador decimal es **ambiguo** según el país, así que no se adivina por
 * el símbolo sino por la forma:
 * - con **los dos** separadores, el **último** es el decimal;
 * - con **uno solo**, 3 dígitos detrás ⇒ es de **miles** (`1.234` = 1234) y 1–2
 *   ⇒ es **decimal** (`12,5` / `12.50`);
 * - repetido (`1.234.567`) ⇒ todos son de miles.
 */
export function parsearImporte(token: string): number | undefined {
  const t = token.replace(/\s/g, "");
  if (!/\d/.test(t)) return undefined;

  const tieneComa = t.includes(",");
  const tienePunto = t.includes(".");

  let limpio = t;
  if (tieneComa && tienePunto) {
    const decimal = t.lastIndexOf(",") > t.lastIndexOf(".") ? "," : ".";
    const miles = decimal === "," ? "." : ",";
    limpio = t.split(miles).join("").replace(decimal, ".");
  } else if (tieneComa || tienePunto) {
    const separador = tieneComa ? "," : ".";
    const partes = t.split(separador);
    if (partes.length > 2) {
      limpio = partes.join(""); // 1.234.567 → todos de miles
    } else {
      const [entera, decimales] = partes;
      limpio = decimales.length === 3 ? entera + decimales : `${entera}.${decimales}`;
    }
  }

  const valor = Number(limpio);
  return Number.isFinite(valor) ? valor : undefined;
}

/**
 * Candidatos numéricos de una línea: primero las formas **agrupadas o con
 * decimales** (las que consume `parsearImporte`) y después cualquier entero.
 */
const RX_CANDIDATO = /\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+[.,]\d{1,2}|\d+/g;

/** Los importes que aparecen en una línea, en orden de aparición. */
function montosDeLinea(linea: string): number[] {
  const candidatos: { valor: number; token: string }[] = [];

  // El OCR separa a veces el decimal del entero (`$46. 73`). Sin pegarlo, la
  // línea queda con **dos** importes (46 y 73) y se acaba eligiendo el equivocado.
  const compacta = linea.replace(/(\d)\s*([.,])\s*(\d)/g, "$1$2$3");

  for (const m of compacta.matchAll(RX_CANDIDATO)) {
    const token = m[0];
    const indice = m.index ?? 0;
    const antes = compacta[indice - 1] ?? " ";
    const despues = compacta[indice + token.length] ?? " ";
    // Un número pegado a un separador de fecha (`10/03/2026`) no es un importe.
    if (/[./-]/.test(antes) || /[./-]/.test(despues)) continue;
    const valor = parsearImporte(token);
    if (valor === undefined) continue;
    candidatos.push({ valor, token });
  }

  if (candidatos.length < 2) return candidatos.map((c) => c.valor);

  // Con más de un número en la línea, un entero de 4 dígitos es la **fecha**
  // (`2026`), no el importe; salvo que traiga separador (`2.026,00`).
  return candidatos
    .filter((c) => /[.,]/.test(c.token) || !(c.valor >= 2000 && c.valor <= 2099))
    .map((c) => c.valor);
}

// ─────────────────────────────────────────────────────────────────────────────
// Total
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rótulos **fuertes**: la frase completa, que gana incluso si la línea aclara algo
 * del IVA.
 *
 * ⚠️ Van con `\b`: sin eso, `TOTAL` daría positivo dentro de `SUBTOTAL`.
 */
const RX_TOTAL_FUERTE =
  /\b(?:total\s+a\s+pagar|total\s+a\s+abonar|total\s+compra|total\s+ticket|importe\s+total|gran\s+total|balance\s+due|amount\s+due|total\s+due)\b/;

/**
 * El rótulo del total cuando es una **sola palabra** (la frase completa la cubre
 * `RX_TOTAL_FUERTE`).
 *
 * ⚠️ `TOTAL` se **lee mal** de muchas formas: además de `tota1` / `T0TAL` (que
 * resuelve `plegarRotulo`), el motor devolvió **`Jotal $46.77`** en la medición del
 * 2026-10-07. Por eso las letras que el OCR confunde van como clases: `t/f/j` en la
 * primera y tercera letra, y `l/1/i` en la última.
 */
const RX_TOTAL = /\b(?:[tfj]o[tf]a[l1i]|importe|suma|amount|a\s+pagar|a\s+abonar)\b/;

/** Etiquetas que **descartan** la línea: es otro importe del ticket. */
const RX_NO_TOTAL =
  /\b(?:sub\s*-?\s*total|iva|i\.v\.a\.?|igic|impuesto|tax|vat|cambio|vuelto|entregado|recibido|efectivo|contado|base|tip|propina|descuento|dto|ahorro|puntos|saldo|gravado)\b/;

/**
 * Pliega las confusiones típicas del OCR **sólo para leer el rótulo**: `tota1`,
 * `T0TAL` y `5UBTOTAL` tienen que seguir siendo el rótulo del total. Nunca se usa
 * para los importes, donde un `1` es un uno.
 *
 * ⚠️ Hay que plegar **antes** de cortar la etiqueta: en `tota1 $46.77` el primer
 * dígito es ese `1` disfrazado de letra, así que sin plegar la etiqueta quedaría
 * en `tota`.
 *
 * ⚠️ Los cierres de paréntesis/corchete y el `!` también salen del motor en lugar
 * de una `l`: en el ticket medido el total se leyó **`Tota) $46. 73`**.
 */
function plegarRotulo(linea: string): string {
  return normalizar(linea)
    .replace(/1/g, "l")
    .replace(/0/g, "o")
    .replace(/5/g, "s")
    .replace(/[)\]}|!]/g, "l");
}

/**
 * ¿La línea es la del total?
 *
 * Un rótulo **fuerte** (`TOTAL A PAGAR`, `IMPORTE TOTAL`) manda: gana incluso si
 * la línea aclara algo del IVA (`TOTAL A PAGAR 12,70 — IVA INCLUIDO`).
 *
 * Si no, la **etiqueta** —lo que antecede al primer número (`SUBTOTAL 10,50` →
 * `subtotal`) — es donde el ticket imprime el rótulo. Si ahí no hay nada, se mira
 * la línea entera, porque algunos tickets imprimen el importe antes del rótulo
 * (`12,70 TOTAL`).
 */
function esLineaDeTotal(linea: string): boolean {
  const n = plegarRotulo(linea);

  if (RX_TOTAL_FUERTE.test(n)) return true;

  const corte = n.search(/\d/);
  const etiqueta = corte === -1 ? n : n.slice(0, corte);
  if (RX_NO_TOTAL.test(etiqueta)) return false;
  if (RX_TOTAL.test(etiqueta)) return true;
  return !RX_NO_TOTAL.test(n) && RX_TOTAL.test(n);
}

/**
 * Busca el **total** entre las líneas del ticket.
 *
 * Si hay más de una línea que dice "total", gana **la más baja** del documento
 * (plan §11.2): los rótulos parciales van arriba y el total general al pie. En la
 * línea elegida se toma el **último** importe (`TOTAL 2 x 6,35  12,70` → 12,70).
 */
function buscarTotal(lineas: string[]): { monto?: number; avisos: string[] } {
  const avisos: string[] = [];
  const candidatas: number[] = [];

  for (const linea of lineas) {
    if (!esLineaDeTotal(linea)) continue;
    const montos = montosDeLinea(linea);
    const monto = montos[montos.length - 1];
    if (monto !== undefined && monto > 0) candidatas.push(monto);
  }

  if (candidatas.length === 0) return { avisos };
  const elegido = candidatas[candidatas.length - 1];
  if (candidatas.length > 1) {
    avisos.push(
      `${candidatas.length} importes con rótulo de total: se tomó el último (${elegido})`
    );
  }
  return { monto: elegido, avisos };
}

// ─────────────────────────────────────────────────────────────────────────────
// Comercio
// ─────────────────────────────────────────────────────────────────────────────

/** Cuántas líneas del encabezado se miran para encontrar el comercio. */
const LINEAS_COMERCIO = 8;

/** Largo máximo razonable del nombre de un comercio. */
const COMERCIO_MAX = 40;

/** Palabras que delatan una línea que **no** es el nombre del comercio. */
const RX_NO_COMERCIO =
  /\b(?:cif|nif|rut|ruc|cuit|cuil|tel|telefono|telf|fax|phone|iva|igic|impuesto|factura|fact|ticket|recibo|presupuesto|fecha|hora|caja|cajero|nro|sucursal|cod|total|subtotal|cambio|vuelto|efectivo|tarjeta|visa|mastercard|debito|credito|gracias|www|http|mail|cliente|vendedor|operador|turno|domicilio|direccion|avda|avenida|calle|localidad)\b|@|https?:|\d{3,}/;

/** Un importe pegado a la línea: el nombre del comercio nunca lleva precio. */
const RX_IMPORTE_EN_LINEA = /(?:[$€£]|us\$)\s*\d|\d+[.,]\d{2}(?!\d)/i;

/**
 * Signos que **no** puede llevar un nombre comercial de verdad.
 *
 * ⚠️ Medido sobre la captura real del celular (2026-10-07): el **logo** manglado
 * sale con signos sueltos de la gráfica (`BESS FOR LE _`, `MITT —`,
 * `: Pe atl: 3 … +`) y eran justamente los candidatos que ganaban el puntaje. Con
 * esto la descripción queda **vacía** cuando no hay un nombre legible, en vez de
 * completarse con basura (el campo es del usuario y tiene el autocompletado del
 * historial).
 */
const RX_SIGNOS_RAROS = /[^\p{L}\p{N} .,'&/()\-]/u;

/** ¿La línea puede ser el nombre del comercio? */
function esComercioPlausible(linea: string): boolean {
  const t = linea.trim();
  if (t.length < 3 || t.length > COMERCIO_MAX) return false;
  if (/^\d/.test(t)) return false;
  if (RX_IMPORTE_EN_LINEA.test(t)) return false;
  if (RX_SIGNOS_RAROS.test(t)) return false;

  const letras = (t.match(/[a-záéíóúüñ]/gi) ?? []).length;
  if (letras < 3) return false;
  // Mayoría de letras: descarta líneas de importes, códigos y direcciones.
  if (letras < t.length / 2) return false;

  return !RX_NO_COMERCIO.test(normalizar(t));
}

/**
 * Puntaje de una línea como posible comercio (más alto = más creíble).
 *
 * El nombre del comercio es **corto, de 1–4 palabras y sin precio**; el OCR del
 * **logo**, en cambio, produce palabras sueltas de una sola letra. Eso es lo que
 * se colaba antes: en el ticket medido el logo de Ross se leyó `sew LEE a`,
 * `AE = S`, `i20SS -` y la "primera línea plausible" era ese ruido.
 */
function puntajeComercio(linea: string): number {
  const t = linea.trim();
  const letras = (t.match(/[a-záéíóúüñ]/gi) ?? []).length;
  const palabras = t.split(/\s+/).filter((p) => /[a-záéíóúüñ]/i.test(p));
  const sueltas = palabras.filter(
    (p) => p.replace(/[^a-záéíóúüñ]/gi, "").length <= 1
  ).length;

  let puntaje = letras;
  if (palabras.length > 4) puntaje -= 20; // es una leyenda, no un nombre
  puntaje -= sueltas * 8; // ruido del logo
  if (t === t.toUpperCase()) puntaje += 4; // la cabecera suele venir en caja alta
  return puntaje;
}

/**
 * Si el OCR lo devolvió **TODO EN MAYÚSCULAS** (lo habitual en un ticket), se
 * pasa a Tipo Título: así la descripción se ve como las que ya tiene el usuario
 * **y** puede coincidir exacta con el historial. Un texto ya mezclado no se toca.
 */
function embellecer(texto: string): string {
  if (/\p{Ll}/u.test(texto)) return texto;
  return texto
    .toLowerCase()
    .replace(/(^|\s)(\p{L})/gu, (_todo, espacio: string, letra: string) =>
      espacio + letra.toUpperCase()
    );
}

/**
 * Limpia el comercio: sin símbolos sueltos en los bordes, sin la **forma
 * jurídica** final (`S.A.`, `S.L.`, `Inc.`) —que no aporta a la descripción del
 * gasto y estorba para reencontrar el mismo comercio en el historial— y sin las
 * **letras sueltas** de los bordes, que son ruido del logo (`DRESS FOR LESS E` ⇒
 * `Dress For Less`).
 */
function limpiarComercio(linea: string): string {
  const sinBordes = linea
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}%)]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();

  const sinForma = sinBordes.replace(
    /[,\s]+(?:s\.?\s*a\.?|s\.?\s*l\.?|s\.?\s*r\.?\s*l\.?|s\.?a\.?s\.?|inc|llc|corp|ltd|cia|company)\.?$/i,
    ""
  );

  const sinSueltas = sinForma
    .replace(/^[^\p{L}\p{N}]*\p{L}[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}]+\p{L}$/u, "")
    .trim();

  return embellecer((sinSueltas.length >= 3 ? sinSueltas : sinForma).trim());
}

/**
 * El comercio: la **mejor** línea plausible del encabezado, no la primera.
 *
 * ⚠️ Tomar la primera era el bug medido en un ticket real: el logo manglado por
 * el OCR (`sew LEE a`) está **antes** del nombre (`DRESS FOR LESS`) y ganaba por
 * orden. Ahora se puntúa (ver `puntajeComercio`) y una línea de puro ruido ni
 * siquiera alcanza el mínimo ⇒ se devuelve `undefined` y la descripción queda
 * vacía antes que mal escrita.
 */
function buscarComercio(lineas: string[]): string | undefined {
  let mejor: string | undefined;
  let mejorPuntaje = 0;

  for (const linea of lineas.slice(0, LINEAS_COMERCIO)) {
    if (!esComercioPlausible(linea)) continue;
    const puntaje = puntajeComercio(linea);
    if (puntaje <= mejorPuntaje) continue;
    const limpio = limpiarComercio(linea);
    if (limpio.length < 3) continue;
    mejorPuntaje = puntaje;
    mejor = limpio;
  }

  return mejor;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extracción completa
// ─────────────────────────────────────────────────────────────────────────────

/** Extrae lo que se pueda del texto del OCR, con los avisos de lo dudoso. */
export function extraerTicket(
  textoOcr: string,
  opciones: OpcionesTicket = {}
): CamposTicket {
  const hoy = opciones.hoy ?? new Date();

  // El comercio se lee de las líneas **crudas** (necesita mayúsculas), pero el
  // resto de las reglas trabaja sobre el texto normalizado.
  const lineas = textoOcr
    .split(/\r?\n/)
    .map((linea) => linea.replace(/\s+/g, " ").trim())
    .filter((linea) => linea.length > 0);

  const { monto, avisos: avisosTotal } = buscarTotal(lineas);
  const { fecha, avisos: avisosFecha } = buscarFecha(normalizar(textoOcr), hoy);
  const descripcion = buscarComercio(lineas);

  const avisos = [...avisosTotal, ...avisosFecha];
  if (monto === undefined) avisos.push("no se encontró el total");
  if (!fecha) avisos.push("no se encontró ninguna fecha");
  if (!descripcion) avisos.push("no se reconoció el comercio");

  return { fecha, monto, descripcion, avisos };
}
