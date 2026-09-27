/**
 * Configs de dictado de los **3 flujos de trabajo** del wizard de movimientos
 * (2026-09-27, plan de voz §8.2 · los "4 flujos de carga" del relevamiento §164):
 *
 * - **Jornada** (`/movimientos/nuevo/jornada`) → `crearDictadoJornada`
 * - **Tarea** (`/movimientos/nuevo/tarea`) → `crearDictadoTarea`
 * - **Cobro** (`/movimientos/nuevo/cobro`) → `crearDictadoCobro`
 *
 * 🔑 Igual que `dictado-gasto.ts`: acá **sólo** se declara *qué campos* se llenan y
 * *de dónde salen las opciones*. El parser (`lib/voz/*`) es genérico.
 *
 * ⚠️ Los `relleno` son **generosos a propósito**: estas pantallas **no tienen campo
 * de Descripción** (el sobrante no tiene dónde caer), así que las palabras de la
 * orden ("cargá", "una jornada", "del", "en") se consumen acá o aparecerían en el
 * aviso *"No entendí: …"*.
 *
 * 📌 El **trabajo** es un campo `opcion` sin `catalogo` (todavía **no** hay ámbito
 * de vocabulario `trabajo`: se resuelve por el **nombre propio** de la etiqueta con
 * el match difuso + los sinónimos de acá). Aprender nombres de trabajos queda como
 * paso siguiente (necesita ámbito nuevo + migración de la tabla de alias).
 */

import { VOZ_LANG } from "@/lib/voz/config";
import type { ConfigDictado } from "@/lib/voz/tipos";
import { ENLACES_ORDEN } from "./dictado-comun";

/** Lo mínimo que las configs necesitan de las opciones del wizard. */
export interface OpcionesDictadoTrabajo {
  /** Trabajos del usuario (el cobro los admite **todos**). */
  trabajos: { id: number; nombre: string }[];
  cuentas: { id: number; nombre: string }[];
}

/**
 * Palabras de la ORDEN que no son contenido en los 3 flujos.
 *
 * 🔑 Los enlaces y artículos salen de **`ENLACES_ORDEN`** (la lista compartida de
 * `dictado-comun.ts`, la misma que usan transferencia y ajuste): tenerla duplicada
 * era pedir que se desincronizaran. ⚠️ **No** se agrega `con`: la tarea tiene campo
 * de Descripción y "logo **con** cliente X" perdería la palabra.
 */
const RELLENO_TRABAJO = [
  ...ENLACES_ORDEN,
  "cargar",
  "carga",
  "cargue",
  "anotar",
  "anota",
  "anote",
  "registrar",
  "registra",
  "agregar",
  "agrega",
  "sumar",
  "suma",
  "nuevo",
  "nueva",
  "para",
];

/** Opciones de trabajo como `OpcionVoz` (id + etiqueta). */
const opcionesTrabajo = (trabajos: OpcionesDictadoTrabajo["trabajos"]) =>
  trabajos.map((t) => ({ value: String(t.id), label: t.nombre }));

const opcionesCuenta = (cuentas: OpcionesDictadoTrabajo["cuentas"]) =>
  cuentas.map((c) => ({ value: String(c.id), label: c.nombre }));

/**
 * **Jornada de trabajo**: *"trabajé en publix el 25 de 9 a 17"* · *"cargá una
 * jornada del lunes de 13 a 17 con 100 de propina en billetera"*.
 *
 * 📌 `horaDesde` va **antes** que `horaHasta` en la lista: es el orden en el que el
 * parser reparte las horas de un rango (`de 9 a 17` ⇒ 09:00 y 17:00).
 */
export function crearDictadoJornada({
  trabajos,
  cuentas,
}: OpcionesDictadoTrabajo): ConfigDictado {
  return {
    lang: VOZ_LANG,
    relleno: [...RELLENO_TRABAJO, "jornada", "jornadas", "trabaje", "trabajar"],
    campos: [
      {
        campo: "idTrabajo",
        tipo: "opcion",
        etiqueta: "Trabajo",
        numerico: true,
        disparadores: ["en el trabajo", "trabajo"],
        opciones: () => opcionesTrabajo(trabajos),
        // ⚠️ **Sin `sinonimos`**: los nombres de los trabajos son del usuario, así
        // que un diccionario fijo acá mapearía a un trabajo ajeno (en el primer
        // intento había `laburo/trabajo → "Publix"`, que era un dato de DEV).
        // El match es por el **nombre propio** de la etiqueta (+ el vocabulario
        // aprendido cuando exista el ámbito `trabajo`).
      },
      {
        campo: "fecha",
        tipo: "fecha",
        etiqueta: "Fecha",
        disparadores: ["fecha", "el dia"],
      },
      {
        campo: "horaDesde",
        tipo: "hora",
        etiqueta: "Hora desde",
        disparadores: ["hora desde", "desde", "entrada", "empece", "arranque"],
      },
      {
        campo: "horaHasta",
        tipo: "hora",
        etiqueta: "Hora hasta",
        disparadores: ["hora hasta", "hasta", "salida", "termine"],
      },
      {
        campo: "montoPropina",
        tipo: "monto",
        etiqueta: "Propina",
        disparadores: ["propina", "de propina", "con propina"],
      },
      {
        campo: "cuentaPropina",
        tipo: "opcion",
        etiqueta: "Cuenta (propina)",
        numerico: true,
        catalogo: "cuenta",
        disparadores: ["cuenta", "en la cuenta", "depositar en"],
        opciones: () => opcionesCuenta(cuentas),
      },
    ],
  };
}

/**
 * **Tarea de trabajo**: *"hice una tarea en labado autos de tres horas por 400"*.
 *
 * 📌 `montoTarea` va antes que `horasTarea`: el número de la frase sin nombrar cae
 * en el **primero** de los dos; las horas se llenan nombrando el campo ("3 horas").
 */
export function crearDictadoTarea({
  trabajos,
}: OpcionesDictadoTrabajo): ConfigDictado {
  return {
    lang: VOZ_LANG,
    relleno: [...RELLENO_TRABAJO, "tarea", "tareas", "hice", "hacer", "por"],
    campos: [
      {
        campo: "idTrabajo",
        tipo: "opcion",
        etiqueta: "Trabajo",
        numerico: true,
        disparadores: ["en el trabajo", "trabajo"],
        opciones: () => opcionesTrabajo(trabajos),
      },
      {
        campo: "descripcionTarea",
        tipo: "texto",
        etiqueta: "Descripción",
        disparadores: ["descripcion", "detalle", "concepto"],
      },
      {
        campo: "fecha",
        tipo: "fecha",
        etiqueta: "Fecha",
        disparadores: ["fecha", "el dia"],
      },
      {
        campo: "horaDesde",
        tipo: "hora",
        etiqueta: "Hora",
        disparadores: ["hora", "a la hora", "a las"],
      },
      {
        campo: "montoTarea",
        tipo: "monto",
        etiqueta: "Monto ganado",
        disparadores: ["monto", "importe", "gane", "cobre"],
      },
      {
        campo: "horasTarea",
        tipo: "monto",
        etiqueta: "Horas",
        disparadores: ["horas", "duracion"],
      },
    ],
  };
}

/**
 * **Cobro de trabajo**: *"cobrá publix"* · *"cobré grand cafe 90 en billetera"* ·
 * *"liquidá TRT del 1 de septiembre al 30 de septiembre"*.
 *
 * 🔑 El campo `idTrabajo` es el que **dispara todo el flujo** en la pantalla: al
 * elegirlo se tildan los ítems pendientes, se calcula el monto y la pantalla avanza
 * (misma lógica que tocar el trabajo en la lista).
 *
 * 📌 `fechaDesde`/`fechaHasta`/`horasPeriodo` son para las modalidades **declaradas**
 * (`fijo`/`horas_fijas`), que no tienen ítems: el rango hay que dictarlo.
 */
export function crearDictadoCobro({
  trabajos,
  cuentas,
}: OpcionesDictadoTrabajo): ConfigDictado {
  return {
    lang: VOZ_LANG,
    relleno: [
      ...RELLENO_TRABAJO,
      "cobrar",
      "cobra",
      "cobre",
      "cobro",
      "liquidar",
      "liquida",
      "liquide",
      "liquidacion",
      "pago",
      "pagar",
      "del",
      "al",
    ],
    campos: [
      {
        campo: "idTrabajo",
        tipo: "opcion",
        etiqueta: "Trabajo",
        numerico: true,
        disparadores: ["el trabajo", "trabajo"],
        opciones: () => opcionesTrabajo(trabajos),
      },
      {
        // ⚠️ **Primer** campo de tipo `fecha` y de tipo `monto` de la lista: son los
        // que reciben el valor de la frase cuando el usuario **no nombra** el campo
        // (`campoFecha`/`campoMonto` del parser). Por eso la fecha del cobro va acá y
        // el período va después, con sus propios disparadores.
        campo: "fecha",
        tipo: "fecha",
        etiqueta: "Fecha del cobro",
        disparadores: ["fecha del cobro", "fecha"],
      },
      {
        campo: "montoOrigen",
        tipo: "monto",
        etiqueta: "Monto",
        disparadores: ["monto", "importe", "total"],
      },
      {
        campo: "fechaDesde",
        tipo: "fecha",
        etiqueta: "Período desde",
        disparadores: ["periodo desde", "desde el", "del"],
      },
      {
        campo: "fechaHasta",
        tipo: "fecha",
        etiqueta: "Período hasta",
        disparadores: ["periodo hasta", "hasta el", "al"],
      },
      {
        campo: "horasPeriodo",
        tipo: "monto",
        etiqueta: "Horas del período",
        disparadores: ["horas", "horas del periodo"],
      },
      {
        campo: "cuentaOrigen",
        tipo: "opcion",
        etiqueta: "Cuenta",
        numerico: true,
        catalogo: "cuenta",
        disparadores: ["cuenta", "en la cuenta", "depositar en"],
        opciones: () => opcionesCuenta(cuentas),
      },
    ],
  };
}
