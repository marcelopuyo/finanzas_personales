/**
 * Config de dictado del paso **"Gasto directo"** del wizard.
 *
 * Es el único archivo específico de la pantalla: declara **qué campos** se pueden
 * llenar por voz y **de dónde salen las opciones**. El parser (`lib/voz/*`) es
 * genérico; este archivo se reusó tal cual en el laboratorio `/voz-lab`.
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
        disparadores: ["cuenta", "de la cuenta", "con la cuenta"],
        opciones: () =>
          cuentas.map((c) => ({ value: String(c.id), label: c.nombre })),
      },
      {
        campo: "idCategoriaGasto",
        tipo: "opcion",
        etiqueta: "Categoría",
        numerico: true,
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
