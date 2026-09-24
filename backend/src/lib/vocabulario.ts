import { LessThan } from "typeorm";
import { getDb } from "../db";
import { norm } from "../../../lib/voz/normalizar";
import type { AmbitoVoz } from "../../../lib/voz/tipos";
import { VozAlias } from "../entities/voz-alias.entity";
import { CategoriaGasto } from "../entities/categoria-gasto.entity";
import { Cuenta } from "../entities/cuenta.entity";

/**
 * **Vocabulario de voz** — lógica de escritura sobre la capa del **usuario**.
 *
 * Vive acá (y no en `actions/voz.ts`) por dos razones:
 * 1. Se puede **probar sin sesión** (recibe el `userId` explícito), y
 * 2. un módulo `"use server"` solo puede exportar funciones `async` — estas
 *    helpers las consumen las Server Actions, que sí resuelven la sesión.
 *
 * La capa de sistema (`usuarioId = null`) se siembra por migración y **no se puede
 * "olvidar"** desde la app.
 */

/** Ámbitos (catálogos) soportados hoy. R12: la granularidad es por catálogo. */
export const AMBITOS_VOZ = ["categoriaGasto", "cuenta"] as const satisfies readonly AmbitoVoz[];
export type { AmbitoVoz };

export interface AprenderInput {
  ambito: AmbitoVoz;
  /** Lo que dijo el usuario ("kiosco"), tal cual. */
  termino: string;
  /** Id de la opción destino (como string, igual que en el parser). */
  destinoValor: string;
  /** `ambiguedad` (eligió un candidato) o `correccion` (arregló lo que puso la voz). */
  origen: "ambiguedad" | "correccion";
}

/** Etiqueta **actual** de la opción, validando que exista y sea del usuario. */
export async function etiquetaDeDestino(
  userId: number,
  ambito: string,
  valor: string
): Promise<string> {
  const ds = await getDb();
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Destino inválido");

  if (ambito === "categoriaGasto") {
    const categoria = await ds.getRepository(CategoriaGasto).findOne({
      where: { id, usuario: { id: userId }, eliminado: false },
    });
    if (!categoria) throw new Error("La categoría destino no existe");
    return categoria.nombre;
  }

  if (ambito === "cuenta") {
    const cuenta = await ds.getRepository(Cuenta).findOne({
      where: { id, usuario: { id: userId }, eliminado: false },
    });
    if (!cuenta) throw new Error("La cuenta destino no existe");
    return cuenta.nombre;
  }

  throw new Error(`Ámbito de voz desconocido: ${ambito}`);
}

/**
 * **Aprende** (o reaprende) un alias: "cuando digo *kiosco*, es la categoría X".
 *
 * - Valida el destino contra las opciones reales (nunca guarda un id inexistente).
 * - **Upsert por (usuario, catálogo, término)**: si ya había un alias **vivo con
 *   otro destino**, se marca `eliminado = true` (queda recuperable) y se crea el
 *   nuevo con `correcciones++`.
 * - Si el destino es **el mismo**, no es un aprendizaje: solo se refresca la
 *   etiqueta (por si la categoría se renombró) y se devuelve `cambiado: false`.
 */
export async function aprenderAliasDeUsuario(
  userId: number,
  input: AprenderInput
): Promise<{ cambiado: boolean; id: number }> {
  const destinoEtiqueta = await etiquetaDeDestino(
    userId,
    input.ambito,
    input.destinoValor
  );
  const terminoNorm = norm(input.termino);
  if (!terminoNorm) throw new Error("Término vacío");

  const ds = await getDb();
  const repo = ds.getRepository(VozAlias);
  const previa = await repo.findOne({
    where: {
      usuario: { id: userId },
      ambito: input.ambito,
      terminoNorm,
      eliminado: false,
    },
  });

  if (previa && previa.destinoValor === input.destinoValor) {
    if (previa.destinoEtiqueta !== destinoEtiqueta) {
      previa.destinoEtiqueta = destinoEtiqueta;
      previa.actualizadoEn = new Date();
      await repo.save(previa);
    }
    return { cambiado: false, id: previa.id };
  }

  if (previa) {
    // Se pisa: la anterior queda recuperable (el "olvidar" de la nueva la reactiva).
    previa.eliminado = true;
    previa.actualizadoEn = new Date();
    await repo.save(previa);
  }

  const nueva = repo.create({
    usuario: { id: userId },
    ambito: input.ambito,
    termino: input.termino,
    terminoNorm,
    destinoValor: input.destinoValor,
    destinoEtiqueta,
    origen: input.origen,
    usos: 0,
    correcciones: previa ? previa.correcciones + 1 : 0,
    activo: true,
    eliminado: false,
  });
  await repo.save(nueva);

  return { cambiado: true, id: nueva.id };
}

/** **Olvida** un alias por id (soft delete de una fila propia). */
export async function olvidarAliasDeUsuario(
  userId: number,
  id: number
): Promise<void> {
  const ds = await getDb();
  const repo = ds.getRepository(VozAlias);

  const fila = await repo.findOne({
    where: { id, usuario: { id: userId }, eliminado: false },
  });
  if (!fila) return;

  fila.eliminado = true;
  fila.actualizadoEn = new Date();
  await repo.save(fila);

  // Si había un alias anterior pisado, se reactiva (vuelve a valer).
  // ⚠️ `id < fila.id`: sin eso, la fila que se acaba de olvidar es la más nueva
  // con `eliminado = true` y se "reactivaba" a sí misma (bug detectado en la
  // verificación contra DEV del 2026-09-24).
  const anterior = await repo.findOne({
    where: {
      usuario: { id: userId },
      ambito: fila.ambito,
      terminoNorm: fila.terminoNorm,
      eliminado: true,
      id: LessThan(fila.id),
    },
    order: { id: "DESC" },
  });
  if (anterior) {
    anterior.eliminado = false;
    anterior.actualizadoEn = new Date();
    await repo.save(anterior);
  }
}

/** **Olvida** el término completo (lo que usa la ✕ del chip del dictado). */
export async function olvidarTerminoDeUsuario(
  userId: number,
  input: { ambito: string; terminoNorm: string }
): Promise<number> {
  const ds = await getDb();
  const repo = ds.getRepository(VozAlias);
  const filas = await repo.find({
    where: {
      usuario: { id: userId },
      ambito: input.ambito,
      terminoNorm: input.terminoNorm,
      eliminado: false,
    },
  });
  for (const fila of filas) {
    fila.eliminado = true;
    fila.actualizadoEn = new Date();
    await repo.save(fila);
  }
  return filas.length;
}

/**
 * **Marca el uso** de un alias propio. Se llama **al guardar** el formulario, no
 * en cada resolución: así el camino crítico del dictado no paga una escritura
 * extra (decisión del 2026-09-23).
 */
export async function registrarUsoDeUsuario(
  userId: number,
  input: { ambito: string; terminoNorm: string }
): Promise<void> {
  const ds = await getDb();
  const repo = ds.getRepository(VozAlias);
  const fila = await repo.findOne({
    where: {
      usuario: { id: userId },
      ambito: input.ambito,
      terminoNorm: input.terminoNorm,
      eliminado: false,
    },
  });
  if (!fila) return;

  fila.usos += 1;
  fila.actualizadoEn = new Date();
  await repo.save(fila);
}
