/**
 * Parser de **intención**: ¿qué quiere hacer el usuario?
 *
 * Regla: hace falta un **sustantivo** del catálogo ("gasto", "cuentas", "balance")
 * o —sólo para la carga— un **verbo de gasto natural** ("gasté", "pagué") con un
 * **número** en la frase. La navegación, además, exige **verbo de movimiento**
 * cuando la frase es larga o el destino lo pide.
 * Sin intención reconocida **no se navega**: se le muestran ejemplos (o, si hay
 * verbo de movimiento y un término suelto, el **catálogo de destinos** — §15.6).
 *
 * ⚠️ Es **puro**: recibe las cuentas del usuario y las órdenes aprendidas por
 * `contexto` (el FAB se las pasa); sin contexto resuelve sólo el catálogo de código.
 */

import { MAX_CANDIDATOS } from "./config";
import { extraerNumeros } from "./numeros";
import { buscarAlias } from "./opciones";
import { DESTINOS_APRENDIBLES, INTENCIONES, NO_ES_GASTO } from "./intenciones";
import { norm, tokenizar } from "./normalizar";
import type {
  AliasOpcion,
  Intencion,
  OpcionVoz,
  ResultadoIntencion,
} from "./tipos";

/** Frase corta: hasta esta cantidad de palabras alcanza el **sustantivo** solo. */
const MAX_SIN_VERBO = 3;

/**
 * Enlaces que se comen al principio del texto sobrante ("de tres mil" → "tres mil")
 * y que **no** cuentan como término significativo cuando hay que aprender una orden
 * ("andá **al** laburo" ⇒ se aprende `laburo`, no `al laburo`).
 */
const ENLACES = new Set([
  "de",
  "del",
  "a",
  "al",
  "un",
  "una",
  "unos",
  "unas",
  "para",
  "el",
  "la",
  "los",
  "las",
  "mi",
  "mis",
]);

/**
 * **Calificadores de moneda** para desambiguar una cuenta hablada (plan §15.2 b):
 * *"galicia **pesos**"* ⇒ la cuenta en ARS, *"galicia **dólares**"* ⇒ la de USD.
 *
 * Se comparan contra el **código** de la moneda de cada cuenta (normalizado) y,
 * si no, contra las palabras de su nombre. Nunca inventan: si el filtro deja la
 * lista vacía, se ignoran y siguen valiendo los candidatos sin filtrar.
 */
const CALIFICADORES: Record<string, string[]> = {
  pesos: ["ars", "arg"],
  peso: ["ars", "arg"],
  argentinos: ["ars", "arg"],
  dolares: ["usd"],
  dolar: ["usd"],
  usd: ["usd"],
  verdes: ["usd"],
  euros: ["eur"],
  euro: ["eur"],
};

/**
 * Marcadores de **consulta**: si aparecen, la frase **no** es una orden de carga
 * ("¿cuánto gasté este mes?" ⇒ ejemplos, sin moverse de pantalla — regla 4 de §15.4).
 *
 * ⚠️ No incluye `que` (demasiado común en frases legítimas). La navegación **no**
 * se ve afectada: exige sustantivo de catálogo.
 */
const CONSULTAS = new Set([
  "cuanto",
  "cuantos",
  "cuanta",
  "cuantas",
  "como",
  "donde",
  "cual",
  "cuales",
  "cuando",
]);

/**
 * Contexto **opcional** del parser (lo arma el FAB; el parser sigue siendo **puro**).
 *
 * Sin contexto (por ejemplo desde `/voz?t=`, en el servidor) el parser resuelve
 * todo lo que no dependa del catálogo real del usuario.
 */
export interface ContextoIntencion {
  /** Catálogo de destinos (por defecto `INTENCIONES`). */
  intenciones?: Intencion[];
  /**
   * **Cuentas del usuario** para el destino parametrizado `ir-cuenta`:
   * `alias` = término dictado → cuentas del usuario (diccionario de sistema del
   * ámbito `cuenta` + lo aprendido) y `monedas` = id de cuenta → código de moneda.
   */
  cuentas?: {
    alias: Map<string, AliasOpcion[]>;
    monedas?: Record<string, string>;
  };
  /** **Órdenes aprendidas** (ámbito `navegacion`): término → id de la intención. */
  navegacion?: Map<string, AliasOpcion[]>;
}

/**
 * Resuelve el **nombre hablado de una cuenta** contra las cuentas del usuario
 * (`contexto.cuentas`): diccionario de sistema del ámbito `cuenta` + lo aprendido.
 *
 * - 1 cuenta ⇒ navegación determinista.
 * - varias ⇒ **candidatos** (y el calificador de moneda filtra: "galicia pesos").
 * - ninguna ⇒ `null` (no es esta orden: se sigue con las otras pasadas).
 */
function resolverCuenta(
  nrm: string[],
  contexto: ContextoIntencion
): { dato?: string; terminoDato?: string; datoCandidatos?: OpcionVoz[] } | null {
  const cuentas = contexto.cuentas;
  if (!cuentas?.alias.size) return null;

  const hit = buscarAlias(nrm, cuentas.alias);
  if (!hit) return null;

  const opciones =
    hit.opciones.length > 1
      ? filtrarPorMoneda(hit.opciones, nrm, cuentas.monedas)
      : hit.opciones;

  if (opciones.length === 1) {
    return { dato: opciones[0].valor, terminoDato: hit.termino };
  }
  return {
    terminoDato: hit.termino,
    datoCandidatos: opciones
      .slice(0, MAX_CANDIDATOS)
      .map((o) => ({ value: o.valor, label: o.etiqueta })),
  };
}

/**
 * Filtra candidatos por el **calificador de moneda** de la frase ("pesos",
 * "dólares", "verdes"…). Si el filtro deja la lista vacía se **ignora**: mejor
 * preguntar de más que inventar una cuenta.
 */
function filtrarPorMoneda(
  opciones: AliasOpcion[],
  nrm: string[],
  monedas?: Record<string, string>
): AliasOpcion[] {
  const codigos = new Set<string>();
  for (const t of nrm) {
    for (const c of CALIFICADORES[t] ?? []) codigos.add(c);
  }
  if (!codigos.size) return opciones;

  const filtradas = opciones.filter((o) => {
    const moneda = norm(monedas?.[o.valor] ?? "");
    const etiqueta = norm(o.etiqueta);
    for (const c of codigos) {
      if (moneda === c || etiqueta.split(" ").includes(c)) return true;
    }
    return false;
  });
  return filtradas.length ? filtradas : opciones;
}

/**
 * Parser de **intención**: ¿qué quiere hacer el usuario?
 *
 * 🔒 **Convención de voz (plan §15): dos pasadas, y sólo dos acciones.**
 *
 * 0. **Órdenes aprendidas** (plan §15.6): lo que el usuario ya eligió alguna vez
 *    gana sobre todo ("muéstrame las deudas" ⇒ el destino que eligió antes).
 * 1. **Navegación** — exige un **sustantivo del catálogo** (regla 2): el verbo de
 *    movimiento es decorativo, y en frases largas hace falta ("muéstrame las
 *    cuentas"). Así *"pagar el préstamo"* navega por **prestamo** (y no abre el
 *    wizard de gasto, que era el bug F2 del QA). Los destinos **parametrizados**
 *    (`ir-cuenta`) resuelven además su dato contra el catálogo del usuario.
 * 2. **Destino no reconocido** (§15.6): orden de movimiento explícita + ningún
 *    sustantivo del catálogo + un término significativo ⇒ se ofrecen **los
 *    destinos navegables** para que el usuario aclare (lo que elija se aprende).
 * 3. **Carga de gasto** — el sustantivo `gasto` **o** un verbo de gasto natural
 *    (`gasté/pagué/compré`) **con un número** en la frase. Si lo único que queda
 *    es texto libre, **no** es una orden de carga ⇒ el FAB muestra ejemplos.
 *
 * ⛔ Si la frase nombra **otra** pantalla del catálogo (préstamos, períodos,
 * resumen…) la carga se cancela: es de otro dominio ("pagué 5000 del préstamo"
 * ⇒ ejemplos, porque el pago de préstamo no está en el catálogo).
 * ⛔ Las **consultas** nunca son una carga (regla 4).
 */
export function parsearIntencion(
  texto: string,
  contexto: ContextoIntencion = {}
): ResultadoIntencion {
  const orig = tokenizar(texto);
  const nrm = orig.map(norm);
  const intenciones = contexto.intenciones ?? INTENCIONES;
  if (!orig.length) return { intencion: null, resto: "" };

  /** Texto sobrante: se descartan las palabras de la intención y los enlaces. */
  const restoDe = (intencion: Intencion) => {
    const usados = new Set<number>();
    nrm.forEach((t, i) => {
      if (
        intencion.sustantivos.includes(t) ||
        intencion.verbos.includes(t) ||
        // Jerga de la orden ("cargar un gasto"): no es contenido.
        (intencion.relleno ?? []).includes(t)
      ) {
        usados.add(i);
      }
    });
    const restantes = orig.filter((_, i) => !usados.has(i));
    let k = 0;
    while (k < restantes.length && ENLACES.has(norm(restantes[k]))) k++;
    return restantes.slice(k).join(" ").trim();
  };

  const navegables = intenciones.filter((i) => i.tipo === "navegacion");
  const carga = intenciones.find((i) => i.tipo === "carga");
  const hayMovimiento = nrm.some((t) =>
    navegables.some((n) => n.verbos.includes(t))
  );
  /** Términos significativos: sin enlaces ni verbos de movimiento. */
  const significativos = nrm.filter(
    (t) => !ENLACES.has(t) && !navegables.some((n) => n.verbos.includes(t))
  );

  // ── Pasada 0: ÓRDENES APRENDIDAS (§15.6) ───────────────────────────────────
  if (contexto.navegacion?.size) {
    const aprendido = buscarAlias(nrm, contexto.navegacion);
    if (aprendido?.opciones.length === 1) {
      const intencion = intenciones.find(
        (i) => i.id === aprendido.opciones[0].valor
      );
      if (intencion) return { intencion, resto: restoDe(intencion) };
    }
  }

  // ── Pasada 1: NAVEGACIÓN (el sustantivo manda) ─────────────────────────────
  for (const intencion of navegables) {
    const haySustantivo = nrm.some((t) => intencion.sustantivos.includes(t));
    if (!haySustantivo) continue;
    const hayVerbo = nrm.some((t) => intencion.verbos.includes(t));
    // Sin verbo de movimiento la frase tiene que ser **corta** para ser una
    // orden ("las cuentas")… salvo en los destinos que lo exigen por colisión
    // con otro vocabulario (`soloConVerbo`: el panel Gastos y la cuenta por nombre).
    if (!hayVerbo && (intencion.soloConVerbo || orig.length > MAX_SIN_VERBO)) {
      continue;
    }

    // **Destino parametrizado** (`ir-cuenta`): hay que resolver el nombre.
    if (intencion.dato === "cuenta") {
      // ⚠️ Guard de la carga: "pagué 3500 con la cuenta galicia" (o "lo pagué con
      // la billetera") es el **campo Cuenta** del wizard, no una orden ⇒ se deja
      // pasar a la pasada de carga / al llenado de campos.
      const esCarga =
        (carga?.verbos.some((v) => nrm.includes(v)) ?? false) ||
        extraerNumeros(orig).length > 0;
      if (esCarga) continue;

      const resuelto = resolverCuenta(nrm, contexto);
      if (!resuelto) continue; // sin nombre reconocible no es esta orden
      return { intencion, resto: "", ...resuelto };
    }

    return { intencion, resto: restoDe(intencion) };
  }

  // ── Pasada 2-bis: DESTINO NO RECONOCIDO (§15.6) ────────────────────────────
  // "muéstrame las deudas del banco": verbo de movimiento + ningún sustantivo del
  // catálogo ⇒ se ofrecen los destinos. Se aprende **sólo** si queda **un** término
  // significativo (con más, navega pero no ensucia el vocabulario).
  if (hayMovimiento && significativos.length) {
    return {
      intencion: null,
      resto: "",
      destinos: contexto.intenciones
        ? navegables.filter((i) => !i.dato)
        : DESTINOS_APRENDIBLES,
      terminoDesconocido:
        significativos.length <= 2 ? significativos.join(" ") : undefined,
    };
  }


  // ── Pasada 2: CARGA ───────────────────────────────────────────────────────
  if (carga) {
    const esConsulta = nrm.some((t) => CONSULTAS.has(t));
    // Si la frase nombra **otra cosa** de la lista (préstamos, períodos, resumen…)
    // es de otro dominio: el pago de préstamo no está en la voz ⇒ ejemplos (no se
    // la apropia el wizard de gasto). Lista curada: ver `NO_ES_GASTO`.
    const otraCosa = nrm.some((t) => NO_ES_GASTO.includes(t));
    if (!esConsulta && !otraCosa && !hayMovimiento) {
      const haySustantivo = nrm.some((t) => carga.sustantivos.includes(t));
      const hayVerbo = nrm.some((t) => carga.verbos.includes(t));
      const hayMonto = extraerNumeros(orig).length > 0;
      if (haySustantivo || (hayVerbo && hayMonto)) {
        return { intencion: carga, resto: restoDe(carga) };
      }
    }
  }

  return { intencion: null, resto: "" };
}
