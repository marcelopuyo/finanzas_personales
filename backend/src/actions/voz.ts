"use server";

import { z } from "zod";
import { requireUserId } from "../lib/auth";
import { refresh } from "../lib/action-helpers";
import {
  AMBITOS_VOZ,
  aprenderAliasDeUsuario,
  olvidarAliasDeUsuario,
  olvidarTerminoDeUsuario,
  registrarUsoDeUsuario,
} from "../lib/vocabulario";

/**
 * **Vocabulario de voz** — Server Actions (G2 del plan de voz).
 *
 * Son cáscaras finas: resuelven la sesión, validan con zod y delegan en
 * `backend/src/lib/vocabulario.ts` (que tiene la lógica y es testeable).
 * ⚠️ Solo tocan la capa **del usuario**: la de sistema la siembra la migración y
 * **no se puede "olvidar"** desde la app.
 */

const ambitoSchema = z.enum(AMBITOS_VOZ);

const aprenderSchema = z.object({
  ambito: ambitoSchema,
  termino: z.string().trim().min(2).max(80),
  destinoValor: z.string().trim().min(1).max(120),
  origen: z.enum(["ambiguedad", "correccion"]),
});

/**
 * Aprende un alias a partir de una elección del usuario: "kiosco" ⇒ esa categoría.
 * Devuelve `cambiado: false` si el término ya apuntaba al mismo destino.
 */
export async function aprenderAlias(input: z.infer<typeof aprenderSchema>) {
  const userId = await requireUserId();
  const data = aprenderSchema.parse(input);

  const { cambiado, id } = await aprenderAliasDeUsuario(userId, data);
  if (cambiado) refresh();
  return { ok: true as const, cambiado, id };
}

/** Olvida un alias propio (soft delete). Reactiva el anterior si lo había pisado. */
export async function olvidarAlias(id: number) {
  const userId = await requireUserId();
  await olvidarAliasDeUsuario(userId, id);
  refresh();
  return { ok: true as const };
}

/** Olvida el término completo (lo que usa la ✕ del chip del dictado). */
export async function olvidarTermino(input: {
  ambito: string;
  terminoNorm: string;
}) {
  const userId = await requireUserId();
  const data = z
    .object({
      ambito: ambitoSchema,
      terminoNorm: z.string().trim().min(1).max(80),
    })
    .parse(input);

  const borrados = await olvidarTerminoDeUsuario(userId, data);
  if (borrados) refresh();
  return { ok: true as const, borrados };
}

/** Suma un uso al alias propio (se llama **al guardar**, no al dictar). */
export async function registrarUsoAlias(input: {
  ambito: string;
  terminoNorm: string;
}) {
  const userId = await requireUserId();
  const data = z
    .object({
      ambito: ambitoSchema,
      terminoNorm: z.string().trim().min(1).max(80),
    })
    .parse(input);

  await registrarUsoDeUsuario(userId, data);
  return { ok: true as const };
}
