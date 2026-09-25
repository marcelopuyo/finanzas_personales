import { IsNull } from "typeorm";
import { getDb } from "../db";
import { Cuenta } from "../entities/cuenta.entity";
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

/** Una cuenta que la voz puede usar como **destino** (`/cuentas/[id]`). */
export interface CuentaVozOut {
  /** Id de la cuenta, como string (es el `value` de la opción de voz). */
  id: string;
  /** Nombre visible: es lo que el usuario dice ("Bco Galicia ARS"). */
  nombre: string;
  /** Código de la moneda ("ARS", "USD"…): desambigua ("galicia **pesos**"). */
  moneda: string;
}

/**
 * **Cuentas navegables por voz** (destino `ir-cuenta`, plan §15.2 b).
 *
 * ⚠️ Son las **del usuario**: el diccionario es genérico, así que cada uno tiene
 * cuentas con nombres distintos y la resolución se hace en memoria, comparando la
 * jerga contra los **tokens de estas etiquetas** (`aliasDeCatalogo`), nunca contra
 * nombres fijos.
 *
 * 🔑 `cuenta.nombre` es **único por usuario** (índice de la tabla), así que el
 * nombre alcanza para nombrarla; el id es el que arma la URL.
 */
export async function getCuentasParaVoz(userId: number): Promise<CuentaVozOut[]> {
  const ds = await getDb();
  const cuentas = await ds.getRepository(Cuenta).find({
    where: { usuario: { id: userId }, eliminado: false },
    relations: { moneda: true },
    order: { orden: "ASC", id: "ASC" },
  });
  return cuentas.map((c) => ({
    id: String(c.id),
    nombre: c.nombre,
    moneda: c.moneda?.codigoISO ?? "",
  }));
}

/**
 * Igual que `getCuentasParaVoz` pero **falla abierto** (misma lección que el
 * vocabulario: la voz es una capa opcional, no puede romper el layout).
 */
export async function getCuentasParaVozSeguro(): Promise<CuentaVozOut[]> {
  const userId = await getSessionUserId();
  if (!userId) return [];
  try {
    return await getCuentasParaVoz(userId);
  } catch (error) {
    console.error("voz: no se pudieron cargar las cuentas", error);
    return [];
  }
}
