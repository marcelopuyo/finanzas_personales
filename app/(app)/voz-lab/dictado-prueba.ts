/**
 * Config de dictado **de prueba** para el laboratorio (F0 del plan).
 *
 * Es espejo de lo que será la config real del paso "Gasto directo" del wizard
 * (F1): mismos nombres de campo y mismas fuentes de opciones. Así lo que se
 * valida en el laboratorio es exactamente lo que después se enchufa al paso.
 *
 * ⚠️ F2/F3: cuando exista `app/(app)/movimientos/stepper/dictado-gasto.ts`, este
 * archivo se borra y el laboratorio importa aquel.
 */

import { VOZ_LANG } from "@/lib/voz/config";
import type { ConfigDictado, OpcionVoz } from "@/lib/voz/tipos";

export interface DatosPrueba {
  cuentas: OpcionVoz[];
  categorias: OpcionVoz[];
}

/**
 * Diccionario local de sinónimos (término dictado → etiquetas de opción).
 * Es lo que permite que "nafta" caiga en "Combustible" sin IA. Se amplía a mano
 * a medida que aparecen casos en el uso real.
 */
const SINONIMOS: Record<string, string[]> = {
  nafta: ["Combustible"],
  gasoil: ["Combustible"],
  combustible: ["Combustible"],
  super: ["Supermercado"],
  verduleria: ["Almacén", "Verdulería"],
  farmacia: ["Salud", "Farmacia"],
  remedios: ["Salud", "Farmacia"],
};

export function crearDictadoPrueba({ cuentas, categorias }: DatosPrueba): ConfigDictado {
  return {
    lang: VOZ_LANG,
    campos: [
      {
        campo: "montoOrigen",
        tipo: "monto",
        disparadores: ["monto", "importe", "total"],
      },
      {
        campo: "fecha",
        tipo: "fecha",
        disparadores: ["fecha", "el dia"],
      },
      {
        campo: "cuentaOrigen",
        tipo: "opcion",
        numerico: true,
        disparadores: ["cuenta", "de la cuenta", "con la cuenta"],
        opciones: () => cuentas,
      },
      {
        campo: "idCategoriaGasto",
        tipo: "opcion",
        numerico: true,
        disparadores: ["categoria", "rubro"],
        opciones: () => categorias,
        sinonimos: SINONIMOS,
        // "gasté mil en el supermercado" → categoría Supermercado **y**
        // descripción "Supermercado".
        aportaTexto: true,
      },
      {
        campo: "descripcion",
        tipo: "texto",
        disparadores: ["descripcion", "concepto", "detalle"],
      },
    ],
  };
}
