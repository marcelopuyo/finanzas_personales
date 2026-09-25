/**
 * Registro de **intenciones globales** (el botón flotante / la entrada por URL
 * interpretan qué quiere hacer el usuario, no los campos de un formulario).
 *
 * ➕ **Agregar una intención = agregar una entrada acá.** Nada más.
 * El alcance del experimento es solo la carga de gastos (D9 del plan).
 */

import { ANCLA_TOPE } from "../panel-scroll";
import type { Intencion } from "./tipos";

/**
 * Verbos de **MOVIMIENTO** (navegación). En normalizado (sin tildes, minúsculas),
 * que es lo que produce `norm()` antes de comparar.
 *
 * ⚠️ Son **decorativos**: la navegación la decide el **sustantivo** (regla 2 de
 * §15.4). Existen para que "muéstrame las cuentas" y "las cuentas" se comporten
 * igual, y para exigir una orden explícita en frases largas (y en los destinos con
 * `soloConVerbo`).
 *
 * 📝 **2026-09-24 (pedido del usuario)**: se sumaron las formas habladas con
 * subordinada (*"quiero que me **muestres**"*, *"quisiera que me **muestres**"*) y
 * los sinónimos *"visualizar"*, *"mostrar"*. Las fórmulas *"quiero ver"* /
 * *"quisiera ver"* / *"ve a"* / *"andá a"* / *"llévame"* ya estaban cubiertas por
 * el verbo suelto (`ver`, `ve`, `anda`, `llevame`) + el `RELLENO_ORDEN`.
 */
const VERBOS_NAVEGAR = [
  "ir",
  "vamos",
  "ve",
  "ver",
  "abrir",
  "abri",
  "abrime",
  "entrar",
  "entra",
  "entrate",
  "mostrar",
  "mostra",
  "mostrame",
  "mostrarme",
  "mostranos",
  "mostras",
  "muestra",
  "muestrame",
  "muestres",
  "muestre",
  "muestren",
  "visualizar",
  "visualiza",
  "visualizame",
  "fijate",
  "fijar",
  "mira",
  "mirar",
  "echa",
  "buscar",
  "busca",
  "buscame",
  "navegar",
  "navega",
  "navegame",
  "llevar",
  "llevame",
  "llavame",
  "yevame",
  "lleva",
  "volver",
  "volve",
  "anda",
  "andate",
  "dame",
];

/**
 * **Relleno de las órdenes habladas**: muletillas y auxiliares que no son
 * contenido ni verbos por sí solos.
 *
 * - No cuentan para el **término a aprender** (§15.6): *"quiero ver las deudas"*
 *   aprende `deudas`, no `quiero ver las deudas`.
 * - Se descartan del **sobrante** que viaja a la pantalla destino.
 *
 * ⛔ `quiero` / `quisiera` **no** son verbos: por sí solos no ordenan nada
 * ("quiero" a secas no navega ni carga).
 */
export const RELLENO_ORDEN = [
  "quiero",
  "quisiera",
  "queria",
  "querria",
  "quieras",
  "podrias",
  "podria",
  "podes",
  "puede",
  "puedes",
  "favor",
  "me",
  "te",
  "nos",
  "que",
  // "mostrame la **pantalla** de cuentas" / "echá un **vistazo**": la palabra no
  // es contenido (el destino lo dice el sustantivo).
  "pantalla",
  "pantallas",
  "vistazo",
];

/**
 * Verbos de **GASTO**: los únicos que alcanzan para una carga (habla natural).
 *
 * ⛔ **Fuera** `cargué` y `anoté` (decisión del usuario, 2026-09-24: no se usan en
 * habla natural para indicar que se hizo un gasto). `cargar` sigue funcionando
 * **sólo** por el sustantivo ("cargar **un gasto**").
 */
const VERBOS_GASTO = [
  "gaste",
  "gastar",
  "gasta",
  "pague",
  "pagar",
  "paga",
  "compre",
  "comprar",
  "compra",
];

/**
 * Nombres que, en una frase de **carga**, significan "esto es otra cosa"
 * (regla 2 de §15.4): si aparecen, la carga se cancela y el FAB muestra ejemplos
 * —*"pagué 5000 del préstamo"* no puede abrir el wizard de gasto—.
 *
 * ⚠️ La lista es **curada a mano** y **no** se deriva de los sustantivos de
 * navegación: deja afuera los términos que sí pueden aparecer en una frase de
 * gasto ("con la **cuenta** galicia", "en el **trabajo**", "mis **gastos**").
 */
export const NO_ES_GASTO = [
  "prestamo",
  "prestamos",
  "deuda",
  "deudas",
  "periodo",
  "periodos",
  "resumen",
  "dashboard",
  "inicio",
  "panel",
  "home",
  "resultado",
  "resultados",
];

export const INTENCIONES: Intencion[] = [
  {
    id: "cargar-gasto",
    tipo: "carga",
    // El **sustantivo** `gasto` alcanza solo. Ojo: "pago/pagar" NO se mapean acá
    // (eran verbos de gasto por convención vieja): ahora "pagar" es un verbo de
    // **gasto** natural, y "pagar el préstamo" navega por el sustantivo
    // (`prestamo`), que manda sobre el verbo.
    // "gaste/gastar" NO van como sustantivos: son **verbos** (ver `VERBOS_GASTO`).
    sustantivos: ["gasto", "gastos"],
    verbos: VERBOS_GASTO,
    // Ruta directa con precarga: el wizard en "modo directo" ya existe y no
    // necesita estado compartido (ver `app/(app)/movimientos/nuevo/[tipo]/page.tsx`).
    href: () => "/movimientos/nuevo/gasto",
    requiereCuenta: true,
    etiqueta: "Gasto",
    // El sobrante ("de tres mil en el super") viaja a la pantalla destino para
    // que lo parsee contra sus campos (ver `lib/voz/handoff.ts`).
    llevaTexto: true,
    // Jerga de la orden (no es contenido): "**cargar** un gasto" ⇒ sin sobrante.
    // ⚠️ No son verbos de la intención (⛔ `cargué`/`anoté` no son habla natural,
    // decisión del usuario): sólo se descartan del resto.
    relleno: [
      "cargar",
      "carga",
      "cargue",
      "anotar",
      "anota",
      "anote",
      "registrar",
      "registra",
      "registrar",
      "ingresar",
      "ingresa",
      "agregar",
      "agrega",
      "agregue",
      "sumar",
      "suma",
      "meter",
      "mete",
      "nuevo",
      "nueva",
    ],
    ejemplo: "gasté 3.500 en el super",
  },

  // ─── Navegación — catálogo CERRADO (plan de voz §15.2) ───────────────────
  // ⚠️ **Agregar un destino = agregar una entrada acá, y nada más.**
  // El **sustantivo** es el que manda (regla 2 de §15.4); el verbo de movimiento
  // es decorativo.
  //
  // 🔑 **`panel`** (§15.5): los destinos que son un **panel del dashboard** llevan
  // el nombre de su ancla. Estando ya en el dashboard, el FAB **scrollea** al panel
  // en vez de navegar (sin barra de carga y sin repetir las 7 consultas); desde
  // otra pantalla navega a `?panel=<ancla>` y el dashboard scrollea al montar. Lo
  // resuelve `lib/panel-scroll.ts` (el dashboard registra su scroll).
  {
    id: "ir-resumen",
    tipo: "navegacion",
    sustantivos: ["resumen", "dashboard", "inicio", "panel", "home"],
    verbos: VERBOS_NAVEGAR,
    href: () => "/dashboard",
    // El resumen **es** el dashboard ⇒ ya estando en él, la orden es "volvé al
    // tope" (antes: `push("/dashboard")` sobre la misma URL = no-op silencioso).
    panel: ANCLA_TOPE,
    etiqueta: "Resumen",
    ejemplo: "andá al resumen",
  },
  // ── Paneles del dashboard (§15.2): la orden **scrollea** hasta el panel.
  // Cada panel tiene su ancla `data-panel="<id>"` y el dashboard lee `?panel=`.
  {
    id: "ir-balance",
    tipo: "navegacion",
    sustantivos: ["balance", "saldo"],
    verbos: VERBOS_NAVEGAR,
    href: () => "/dashboard?panel=balance",
    panel: "balance",
    etiqueta: "Balance",
    ejemplo: "mostrame el balance",
  },
  {
    id: "ir-panel-cuentas",
    tipo: "navegacion",
    // ⚠️ Sólo el **plural**: el singular `cuenta` es el nombre de un **campo** del
    // wizard ("pagué 3500 con la cuenta galicia" tiene que seguir siendo una carga).
    sustantivos: ["cuentas"],
    verbos: VERBOS_NAVEGAR,
    href: () => "/dashboard?panel=cuentas",
    panel: "cuentas",
    etiqueta: "Cuentas",
    ejemplo: "mostrame las cuentas",
  },
  {
    // **Destino parametrizado** por el nombre de la cuenta (plan §15.2 b):
    // "muéstrame la cuenta <nombre>" ⇒ `/cuentas/[id]`.
    id: "ir-cuenta",
    tipo: "navegacion",
    sustantivos: ["cuenta"],
    verbos: VERBOS_NAVEGAR,
    // ⚠️ **Exige el verbo de movimiento**: sin él, "cuenta billetera" es el
    // **campo** Cuenta del wizard (regla 7: nombre de campo + texto) y no una
    // orden de navegación.
    soloConVerbo: true,
    // El id lo resuelve el parser contra **las cuentas del usuario**
    // (`contexto.cuentas`): diccionario de sistema (`ámbito cuenta`) + lo aprendido.
    href: (dato) => `/cuentas/${dato ?? ""}`,
    dato: "cuenta",
    etiqueta: "Cuenta",
    ejemplo: "mostrame la cuenta billetera",
  },
  {
    id: "ir-panel-trabajo",
    tipo: "navegacion",
    sustantivos: ["trabajo", "trabajos"],
    verbos: VERBOS_NAVEGAR,
    href: () => "/dashboard?panel=trabajo",
    panel: "trabajo",
    etiqueta: "Trabajo",
    ejemplo: "mostrame el trabajo",
  },  {
    id: "ir-panel-gastos",
    tipo: "navegacion",
    // ⚠️ Sólo el plural, y **con verbo de movimiento**: `gasto/gastos` son los
    // sustantivos de la carga, así que "cargar gastos" o "un gasto" no navegan.
    sustantivos: ["gastos"],
    verbos: VERBOS_NAVEGAR,
    soloConVerbo: true,
    href: () => "/dashboard?panel=gastos",
    panel: "gastos",
    etiqueta: "Gastos",
    ejemplo: "mostrame los gastos",
  },
  {
    id: "ir-panel-ingresos",
    tipo: "navegacion",
    sustantivos: ["ingresos"],
    verbos: VERBOS_NAVEGAR,
    href: () => "/dashboard?panel=ingresos",
    panel: "ingresos",
    etiqueta: "Ingresos",
    ejemplo: "mostrame los ingresos",
  },
  {
    id: "ir-panel-resultados",
    tipo: "navegacion",
    sustantivos: ["resultado", "resultados"],
    verbos: VERBOS_NAVEGAR,
    href: () => "/dashboard?panel=resultados",
    panel: "resultados",
    etiqueta: "Resultados",
    ejemplo: "mostrame los resultados",
  },
  {
    id: "ir-panel-prestamos",
    tipo: "navegacion",
    // "deudas" es jerga natural para préstamos.
    sustantivos: ["prestamo", "prestamos", "deuda", "deudas"],
    verbos: VERBOS_NAVEGAR,
    href: () => "/dashboard?panel=prestamos",
    panel: "prestamos",
    etiqueta: "Préstamos",
    ejemplo: "mostrame los préstamos",
  },
  {
    id: "ir-periodos",
    tipo: "navegacion",
    // Normalizado: "períodos" → "periodos" (lo que ve el matcher).
    sustantivos: ["periodo", "periodos"],
    verbos: VERBOS_NAVEGAR,
    href: () => "/cruds/periodos-trabajo",
    etiqueta: "Períodos de trabajo",
    ejemplo: "andá a los períodos",
  },
];

/**
 * Destinos que se ofrecen cuando **no se entiende** una orden de navegación
 * (plan §15.6, regla 4): el catálogo **menos** `ir-cuenta`, que es **parametrizado**
 * por un nombre, así que no tiene sentido como opción suelta — ya tiene su propia
 * vía ("muéstrame la cuenta \<nombre\>").
 */
export const DESTINOS_APRENDIBLES: Intencion[] = INTENCIONES.filter(
  (i) => i.tipo === "navegacion" && !i.dato
);
