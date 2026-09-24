/**
 * Config de dictado del paso **"Gasto directo"** del wizard.
 *
 * Es el único archivo específico de la pantalla: declara **qué campos** se pueden
 * llenar por voz y **de dónde salen las opciones**. El parser (`lib/voz/*`) es
 * genérico y se reusa tal cual desde otros pasos del wizard.
 *
 * ⚠️ **Hoy sin consumidores** (2026-09-23): el panel "Cargar por voz" se **retiró**
 * con el replanteo de la voz (§14 del plan: **sin campo de texto ni panel**, un
 * **FAB 🎤** que llena la pantalla actual). Se conserva a propósito: es la config
 * que va a usar ese FAB (fase G3).
 *
 * Los nombres de campo son los de `MovimientoData` y los valores son los **id**
 * (por eso `numerico: true`), porque el wizard selecciona cuentas y categorías
 * por id.
 */

import { VOZ_LANG } from "@/lib/voz/config";
import type { ConfigDictado } from "@/lib/voz/tipos";

/** Lo mínimo que la config necesita de las opciones del wizard. */
export interface OpcionesDictadoGasto {
  cuentas: { id: number; nombre: string }[];
  categoriasGasto: { id: number; nombre: string }[];
}

/**
 * Diccionario local de sinónimos (término dictado → **nombre** de la opción).
 *
 * Es lo que permite que "nafta" caiga en la categoría "Combustible" **sin IA**.
 * Se amplía a mano con los nombres reales que existan en la base: si la etiqueta
 * no coincide con ninguna categoría, simplemente no se asigna.
 */
const SINONIMOS: Record<string, string[]> = {
  nafta: ["Combustible"],
  gasoil: ["Combustible"],
  combustible: ["Combustible"],
  super: ["Supermercado"],
  verduleria: ["Almacén", "Verdulería"],
  farmacia: ["Salud", "Farmacia"],
  remedios: ["Salud", "Farmacia"],
  luz: ["Servicios", "Servicios e impuestos"],
  internet: ["Servicios", "Servicios e impuestos"],
};

export function crearDictadoGasto({
  cuentas,
  categoriasGasto,
}: OpcionesDictadoGasto): ConfigDictado {
  return {
    lang: VOZ_LANG,
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
      {
        campo: "cuentaOrigen",
        tipo: "opcion",
        etiqueta: "Cuenta",
        numerico: true,
        // Catálogo al que apunta (R12): lo usa el vocabulario ("billetera", "caja"…).
        catalogo: "cuenta",
        disparadores: ["cuenta", "de la cuenta", "con la cuenta"],
        opciones: () =>
          cuentas.map((c) => ({ value: String(c.id), label: c.nombre })),
      },
      {
        campo: "idCategoriaGasto",
        tipo: "opcion",
        etiqueta: "Categoría",
        numerico: true,
        catalogo: "categoriaGasto",
        disparadores: ["categoria", "rubro"],
        opciones: () =>
          categoriasGasto.map((c) => ({ value: String(c.id), label: c.nombre })),
        sinonimos: SINONIMOS,
        // "gasté mil en el supermercado" → categoría Supermercado **y**
        // descripción "Supermercado".
        aportaTexto: true,
      },
      {
        campo: "descripcion",
        tipo: "texto",
        etiqueta: "Descripción",
        disparadores: ["descripcion", "concepto", "detalle"],
      },
    ],
  };
}
