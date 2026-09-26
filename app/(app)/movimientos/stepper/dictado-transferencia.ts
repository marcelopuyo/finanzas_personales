/**
 * Config de dictado del paso **"Transferencia"** del wizard (plan de voz §16.2).
 *
 * Campos del paso (`stepper/transferencia.tsx`, sobre `MovimientoData`): fecha · motivo ·
 * cuenta origen · monto origen · cuenta destino · **monto destino**.
 *
 * ⚠️ **`montoDestino` NO se dicta**: la pantalla lo **autocompleta** desde
 * `montoOrigen` (misma moneda ⇒ mismo monto; monedas distintas ⇒ cotizado) mientras el
 * usuario no lo edite a mano. Dictarlo obligaría a pelear con ese efecto.
 *
 * 🔑 **Las dos cuentas son campos HERMANOS** (mismo catálogo `cuenta`), y eso es lo
 * único delicado de esta pantalla:
 * - `cuentaDestino` va **primero** y con **`soloEnZona`**: sólo se llena si la frase lo
 *   **marca** (*"**a** billetera"*, *"hacia la cuenta caja 1"*). Así **nunca adivina** ni
 *   se lleva la cuenta que el usuario dijo para el origen (ver `CampoDictable.soloEnZona`).
 * - `cuentaOrigen` sí acepta el resto de la frase (con su marcador *"de la cuenta"* /
 *   *"desde"* o por el vocabulario), que es el caso natural: *"pasá 5.000 **de galicia**
 *   **a** billetera"*.
 *
 * ⚠️ **Límite conocido del parser** (no de esta config): los **números van antes** de los
 * marcadores. *"5.000 de la cuenta galicia a billetera"* ✓ · *"de la cuenta galicia 5.000"*
 * ✗ (el número cae dentro de la zona del marcador y no se toma, porque la zona llega hasta
 * el final de la frase). El monto siempre se dice primero.
 */

import { VOZ_LANG } from "@/lib/voz/config";
import type { ConfigDictado } from "@/lib/voz/tipos";
import { ENLACES_ORDEN } from "./dictado-comun";
import { MOTIVOS_TRANSFERENCIA } from "./types";

/** Lo mínimo que la config necesita de las opciones del wizard. */
export interface OpcionesDictadoTransferencia {
  cuentas: { id: number; nombre: string }[];
}

/**
 * Sinónimos de los **motivos** (los 5 del enum del backend). El resto entra por el
 * match difuso: los nombres de los motivos son palabras comunes y norm() los iguala
 * ("extracción" ⇒ "Extraccion", "depósito" ⇒ "Deposito").
 */
const SINONIMOS_MOTIVO: Record<string, string[]> = {
  saque: ["Extraccion"],
  extraje: ["Extraccion"],
  // "dólares" no alcanza para decidir: puede ser compra o venta ⇒ candidatos (D6).
  dolares: ["Compra Dolares", "Venta Dolares"],
};

export function crearDictadoTransferencia({
  cuentas,
}: OpcionesDictadoTransferencia): ConfigDictado {
  const opcionesCuenta = () =>
    cuentas.map((c) => ({ value: String(c.id), label: c.nombre }));

  return {
    lang: VOZ_LANG,
    // La ORDEN no es contenido ("**pasá** **de** galicia **a** billetera").
    // ⚠️ "transferencia" NO va acá: es una etiqueta de `motivo`.
    relleno: [
      ...ENLACES_ORDEN,
      "pasa",
      "pase",
      "paso",
      "pasaron",
      "pasamos",
      "pasar",
      "pasame",
      "transfiere",
      "transferi",
      "transferir",
      "haceme",
      "manda",
      "mande",
      "mando",
      "mandar",
      "cuenta",
    ],
    campos: [
      {
        campo: "montoOrigen",
        tipo: "monto",
        etiqueta: "Monto",
        disparadores: ["monto", "importe", "total"],
      },
      {
        campo: "fecha",
        tipo: "fecha",
        etiqueta: "Fecha",
        disparadores: ["fecha", "el dia"],
      },
      // ⚠️ El DESTINO va primero y no adivina (`soloEnZona`): ver el comentario de arriba.
      {
        campo: "cuentaDestino",
        tipo: "opcion",
        etiqueta: "Cuenta destino",
        numerico: true,
        catalogo: "cuenta",
        soloEnZona: true,
        disparadores: ["a la cuenta", "hacia la cuenta", "para la cuenta", "a", "hacia", "para"],
        opciones: opcionesCuenta,
      },
      {
        campo: "cuentaOrigen",
        tipo: "opcion",
        etiqueta: "Cuenta origen",
        numerico: true,
        catalogo: "cuenta",
        disparadores: ["de la cuenta", "desde la cuenta", "desde el", "desde"],
        opciones: opcionesCuenta,
      },
      {
        campo: "motivo",
        tipo: "opcion",
        etiqueta: "Motivo",
        opciones: () =>
          MOTIVOS_TRANSFERENCIA.map((m) => ({ value: m, label: m })),
        sinonimos: SINONIMOS_MOTIVO,
      },
    ],
  };
}
