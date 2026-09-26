/**
 * Config de dictado del paso **"Ajuste de cuenta"** del wizard (plan de voz §16.2).
 *
 * Campos del paso (`stepper/ajuste-cuenta.tsx`, sobre `MovimientoData`): fecha ·
 * cuenta · **monto** (el que admite negativos).
 *
 * 🔑 **Es el único flujo con monto negativo** (hueco 2 del plan): el campo del wizard se
 * declara con `allowNegative` y su etiqueta ya dice *"positivo: ingreso / negativo:
 * egreso"* (el backend hace `cuenta.saldo += monto`). Acá se declara con
 * **`permiteNegativo`** para que el parser entienda el marcador:
 *
 * | Frase | Monto |
 * |---|---|
 * | *"ajustá 500"* / *"ajustá la cuenta billetera en 500"* | **+500** (ingreso) |
 * | *"ajustá la cuenta billetera en **menos** 500"* | **−500** (egreso) |
 *
 * ⚠️ El marcador se lee **pegado antes** del número y por **palabra** (`menos`,
 * `negativo`): el `-` literal no llega (`tokenizar()` recorta la puntuación de los
 * extremos del token). Los verbos de resta (*"restá"*, *"descontá"*) quedaron **fuera**
 * por decisión del usuario (2026-09-25): se suman más adelante si hacen falta.
 *
 * ⚠️ **La cuenta va SIN `disparadores`** a propósito: si se declarara *"cuenta"* como
 * disparador, la zona de ese campo llegaría hasta el final de la frase y el **monto
 * quedaría adentro** (*"ajustá la cuenta billetera en menos 500"* ⇒ el 500 no se toma).
 * Sin disparadores, el nombre de la cuenta entra por el **vocabulario** (el catálogo
 * `cuenta`: lo de sistema + lo aprendido), que es como funciona en el gasto.
 */

import { VOZ_LANG } from "@/lib/voz/config";
import type { ConfigDictado } from "@/lib/voz/tipos";
import { ENLACES_ORDEN } from "./dictado-comun";

/** Lo mínimo que la config necesita de las opciones del wizard. */
export interface OpcionesDictadoAjuste {
  cuentas: { id: number; nombre: string }[];
}

export function crearDictadoAjuste({
  cuentas,
}: OpcionesDictadoAjuste): ConfigDictado {
  return {
    lang: VOZ_LANG,
    // La ORDEN no es contenido: sin esto el sobre "No entendí: «ajustá la cuenta en»".
    relleno: [
      ...ENLACES_ORDEN,
      "ajusta",
      "ajustar",
      "ajuste",
      "ajustes",
      "corregi",
      "corregir",
      "corrige",
      "cuenta",
    ],
    campos: [
      {
        campo: "montoOrigen",
        tipo: "monto",
        etiqueta: "Monto",
        permiteNegativo: true,
        disparadores: ["monto", "importe", "ajuste"],
      },
      {
        campo: "fecha",
        tipo: "fecha",
        etiqueta: "Fecha",
        disparadores: ["fecha", "el dia"],
      },
      {
        campo: "cuentaOrigen",
        tipo: "opcion",
        etiqueta: "Cuenta",
        numerico: true,
        catalogo: "cuenta",
        opciones: () =>
          cuentas.map((c) => ({ value: String(c.id), label: c.nombre })),
      },
    ],
  };
}
