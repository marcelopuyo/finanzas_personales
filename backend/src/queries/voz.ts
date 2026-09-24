import { IsNull } from "typeorm";
import { getDb } from "../db";
import { VozAlias } from "../entities/voz-alias.entity";
import { getSessionUserId } from "../lib/auth";

/**
 * **Vocabulario de voz** — lectura (G2 del plan de voz).
 *
 * La tabla tiene dos capas (`usuarioId`):
 * - **`null` = SISTEMA**: conceptos estándar + jerga genérica, igual para todos.
 *   `destinoValor` es un **concepto** ("tabaco"), no un id.
 * - **el usuario**: lo que aprendió. `destinoValor` es el **id** de su opción.
 *
 * ⚠️ El diccionario **no contiene nombres de categorías**: la traducción
 * concepto → categoría real la hace `lib/voz/vocabulario.ts` **en memoria**,
 * contra las opciones que ya cargó cada pantalla.
 */

/** Una fila del vocabulario, tal como la consume el cliente. */
export interface AliasVozOut {
  id: number;
  /** `null` = capa de sistema (sirve a todos los usuarios). */
  usuarioId: number | null;
  /** Catálogo al que apunta: `categoriaGasto` · `cuenta` (R12). */
  ambito: string;
  termino: string;
  /** Clave de búsqueda (minúsculas, sin tildes). */
  terminoNorm: string;
  /** Id de la opción (capa del usuario) o **concepto** (capa de sistema). */
  destinoValor: string;
  /** Etiqueta del destino (solo para mostrar). */
  destinoEtiqueta: string;
  origen: string;
  usos: number;
  correcciones: number;
}

function aSalida(a: VozAlias): AliasVozOut {
  return {
    id: a.id,
    usuarioId: a.usuario ? a.usuario.id : null,
    ambito: a.ambito,
    termino: a.termino,
    terminoNorm: a.terminoNorm,
    destinoValor: a.destinoValor,
    destinoEtiqueta: a.destinoEtiqueta,
    origen: a.origen,
    usos: a.usos,
    correcciones: a.correcciones,
  };
}

/**
 * Snapshot del vocabulario: **sistema + usuario en una sola consulta**.
 *
 * Se llama **una vez** por render del layout de la app (no por pantalla) y el
 * resultado vive en memoria en `VozProvider`.
 */
export async function getVocabulario(userId: number): Promise<AliasVozOut[]> {
  const ds = await getDb();
  const filas = await ds.getRepository(VozAlias).find({
    // Array = OR: las del sistema (usuario NULL) y las propias. Ambas **vivas**
    // (las eliminadas son el historial del "olvidar" y no se mandan al cliente).
    where: [
      { usuario: IsNull(), eliminado: false },
      { usuario: { id: userId }, eliminado: false },
    ],
    relations: { usuario: true },
    order: { ambito: "ASC", terminoNorm: "ASC" },
  });
  return filas.map(aSalida);
}

/**
 * Igual que `getVocabulario` pero **falla abierto**: sin sesión o si la BD no
 * responde devuelve `[]` y lo registra.
 *
 * 🔑 El layout raíz **no puede romperse** por una capa opcional (misma lección
 * que `biometriaParaBloqueo`): sin vocabulario el dictado sigue funcionando, solo
 * sin jerga preaprendida.
 */
export async function getVocabularioSeguro(): Promise<AliasVozOut[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];
  try {
    return await getVocabulario(userId);
  } catch (error) {
    console.error("voz: no se pudo cargar el vocabulario", error);
    return [];
  }
}

/**
 * Solo lo **aprendido por el usuario**, para la lista «Lo que aprendí» (R11).
 * No incluye la capa de sistema (no se puede "olvidar" lo que es de todos).
 */
export async function getAliasAprendidos(): Promise<AliasVozOut[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];

  const ds = await getDb();
  const filas = await ds.getRepository(VozAlias).find({
    where: { usuario: { id: userId }, eliminado: false },
    relations: { usuario: true },
    order: { actualizadoEn: "DESC", creadoEn: "DESC" },
  });
  return filas.map(aSalida);
}
