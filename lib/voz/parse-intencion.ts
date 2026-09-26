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
import {
  DESTINOS_APRENDIBLES,
  INTENCIONES,
  NO_ES_GASTO,
  RELLENO_ORDEN,
} from "./intenciones";
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
  ars: ["ars"],
  dolares: ["usd"],
  dolar: ["usd"],
  usd: ["usd"],
  verdes: ["usd"],
  euros: ["eur"],
  euro: ["eur"],
};

/**
 * Términos que **no** identifican una cuenta por sí solos: los enlaces y el propio
 * sustantivo (`cuenta`, `cuentas`). Evita que *"muéstrame **la cuenta** caja 1"* se
 * resuelva por la palabra "cuenta" en vez de por el nombre.
 */
const NO_IDENTIFICA = new Set<string>([...ENLACES, "cuenta", "cuentas"]);

/** Ventanas del dictado, de la **más específica** a la menos: pares y luego sueltas. */
function ventanasDictado(nrm: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < nrm.length - 1; i++) out.push(`${nrm[i]} ${nrm[i + 1]}`);
  out.push(...nrm);
  return out;
}

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
    /** Cuentas del usuario, para resolver por el **nombre propio** de cada una. */
    opciones?: OpcionVoz[];
  };
  /** **Órdenes aprendidas** (ámbito `navegacion`): término → id de la intención. */
  navegacion?: Map<string, AliasOpcion[]>;
}

/** Máximo de cuentas que se ofrecen cuando el nombre no se reconoce. */
const MAX_CUENTAS_OFERTA = 8;

/**
 * Resuelve el **nombre hablado de una cuenta** contra las cuentas del usuario
 * (`contexto.cuentas`).
 *
 * Se prueban **dos capas**, porque un usuario puede nombrar la cuenta de dos
 * maneras y las dos son legítimas:
 *
 * 1. **El nombre propio de la cuenta** — cualquier **tramo** de su etiqueta
 *    ("caja 1", "truist", "galicia", "transito western"): es lo que el usuario lee
 *    en la app y dice tal cual. Se prueban primero los **pares** (más específicos:
 *    *"caja 1"* gana sobre *"caja"*) y después las palabras sueltas; se saltean los
 *    enlaces y el sustantivo `cuenta` (si no, *"muéstrame la cuenta caja 1"* se
 *    resolvería por la palabra "cuenta").
 * 2. **El vocabulario** (jerga de sistema + lo aprendido): `caja`, `billetera`,
 *    `plata`, `mercado pago`… y lo que el usuario ya eligió alguna vez.
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
  if (!cuentas) return null;

  const propio = porNombreDeCuenta(nrm, cuentas.opciones ?? []);
  const vocab = cuentas.alias.size ? buscarAlias(nrm, cuentas.alias) : undefined;
  // El **nombre propio** gana: es más específico y es el que el usuario ve.
  const hit = propio ?? vocab;
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
 * **Nombre propio**: busca en el dictado un tramo de la etiqueta de alguna cuenta
 * (comparación por tokens **exactos**, sin difuso: los nombres de cuenta no son
 * vocabulario, son texto del usuario).
 */
function porNombreDeCuenta(
  nrm: string[],
  opciones: OpcionVoz[]
): { termino: string; opciones: AliasOpcion[] } | undefined {
  if (!opciones.length) return undefined;
  const etiquetas = opciones.map((o) => ({
    opcion: o,
    tokens: norm(o.label).split(" ").filter(Boolean),
  }));

  for (const ventana of ventanasDictado(nrm)) {
    const partes = ventana.split(" ");
    if (partes.some((p) => NO_IDENTIFICA.has(p))) continue;

    const hits = etiquetas.filter(({ tokens }) =>
      tokens.some((_, i) => partes.every((p, k) => tokens[i + k] === p))
    );
    if (!hits.length) continue;

    return {
      termino: ventana,
      opciones: hits.map(({ opcion }) => ({
        valor: opcion.value,
        etiqueta: opcion.label,
        puntaje: 1,
        concepto: "etiqueta",
      })),
    };
  }
  return undefined;
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
 * ⛔ Las **consultas** ("cuánto gasté este mes") quedan **fuera del uso**: la voz no
 * las interpreta como orden, no navega, no llena campos y no ofrece destinos; el
 * FAB lo dice tal cual (`esConsulta`, decisión del usuario 2026-09-24).
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
    while (
      k < restantes.length &&
      (ENLACES.has(norm(restantes[k])) || RELLENO_ORDEN.includes(norm(restantes[k])))
    ) {
      k++;
    }
    return restantes.slice(k).join(" ").trim();
  };

  const navegables = intenciones.filter((i) => i.tipo === "navegacion");
  /**
   * Las **cargas** del catálogo (hoy: gasto · transferencia · ajuste).
   *
   * ⚠️ Antes era **una sola** (`find`): con la transferencia y el ajuste hay que
   * probar las tres y quedarse con la que matchea (ver la pasada 2).
   */
  const cargas = intenciones.filter((i) => i.tipo === "carga");
  /**
   * Sustantivos de los destinos **parametrizados** (hoy: `cuenta`).
   *
   * Sirven para **no** ofrecer el catálogo de destinos cuando la frase los nombra:
   * *"muéstrame la cuenta galicia"* no es "no sé a dónde querés ir" — es una
   * cuenta que no se reconoció (2026-09-25, reportado desde el celular).
   */
  const nombresParametrizados = navegables
    .filter((i) => i.dato)
    .flatMap((i) => i.sustantivos);
  /**
   * **Consulta** ("cuánto gasté este mes", "cómo vengo"): la voz **no la usa**.
   * No navega, no llena campos y **no** ofrece el catálogo de destinos.
   */
  const esConsulta = nrm.some((t) => CONSULTAS.has(t));
  const hayMovimiento = nrm.some((t) =>
    navegables.some((n) => n.verbos.includes(t))
  );
  /**
   * Términos significativos: sin enlaces, sin muletillas de la orden
   * (`RELLENO_ORDEN`: "quiero", "que", "me"…) ni verbos de movimiento.
   */
  const significativos = nrm.filter(
    (t) =>
      !ENLACES.has(t) &&
      !RELLENO_ORDEN.includes(t) &&
      !navegables.some((n) => n.verbos.includes(t))
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
      // ⚠️ Guard de la carga: *"pagué 3500 con la cuenta galicia"* es el **campo
      // Cuenta** del wizard, no una orden. Se mira el **verbo de gasto** (no el
      // número: *"muéstrame la cuenta caja **1**"* es un nombre con dígitos y tiene
      // que navegar; y una frase de carga sin verbo de gasto ya queda afuera por
      // `soloConVerbo`).
      const esCarga = cargas.some((c) => c.verbos.some((v) => nrm.includes(v)));
      if (esCarga) continue;

      const resuelto = resolverCuenta(nrm, contexto);
      if (resuelto) return { intencion, resto: "", ...resuelto };

      // No se reconoció el nombre: la orden **sí** era "una cuenta" ⇒ se ofrecen
      // **todas las cuentas del usuario** (mucho mejor que el catálogo de destinos:
      // el usuario ya dijo lo que quería). Al elegir, se aprende el término.
      const todas = contexto.cuentas?.opciones ?? [];
      if (todas.length) {
        return {
          intencion,
          resto: "",
          datoSinResolver: true,
          terminoDato: significativos
            .filter((t) => !NO_IDENTIFICA.has(t))
            .join(" "),
          datoCandidatos: todas
            .slice(0, MAX_CUENTAS_OFERTA)
            .map((o) => ({ value: o.value, label: o.label })),
        };
      }
      continue; // sin cuentas cargadas no hay nada que ofrecer
    }

    return { intencion, resto: restoDe(intencion) };
  }

  // ── Pasada 2-bis: DESTINO NO RECONOCIDO (§15.6) ────────────────────────────
  // "muéstrame las deudas del banco": verbo de movimiento + ningún sustantivo del
  // catálogo ⇒ se ofrecen los destinos. Se aprende **sólo** si queda **un** término
  // significativo (con más, navega pero no ensucia el vocabulario).
  if (
    hayMovimiento &&
    significativos.length &&
    !esConsulta &&
    // Si la frase nombra un destino **parametrizado** ("la cuenta …"), el catálogo
    // de destinos no es la respuesta: eso ya se intentó resolver arriba.
    !nrm.some((t) => nombresParametrizados.includes(t))
  ) {
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

  // ── Pasada 2: CARGA (puede haber varias: gasto · transferencia · ajuste) ──
  if (cargas.length && !esConsulta && !hayMovimiento) {
    // El **gasto** conserva su guard de "otra cosa": si la frase nombra préstamos,
    // períodos, resumen… (lista curada `NO_ES_GASTO`, que ya incluye las **otras
    // cargas**) no se la apropia. Las cargas nuevas no lo necesitan: se disparan por
    // **su** sustantivo o por **su** verbo, que no comparten con el gasto (`pasé`,
    // `ajustá`… no están en `VERBOS_GASTO`).
    const otraCosa = nrm.some((t) => NO_ES_GASTO.includes(t));
    const hayMonto = extraerNumeros(orig).length > 0;
    for (const carga of cargas) {
      if (carga.id === "cargar-gasto" && otraCosa) continue;
      const haySustantivo = nrm.some((t) => carga.sustantivos.includes(t));
      const hayVerbo = nrm.some((t) => carga.verbos.includes(t));
      if (haySustantivo || (hayVerbo && hayMonto)) {
        return { intencion: carga, resto: restoDe(carga) };
      }
    }
  }

  return { intencion: null, resto: "", esConsulta };
}
