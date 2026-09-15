"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "../db";
import { WebauthnCredential } from "../entities/webauthn-credential.entity";
import { requireUserId } from "../lib/auth";
import {
  leerPistaCredencial,
  olvidarPistaCredencial,
} from "../lib/webauthn";

/**
 * Acciones de gestión de passkeys (login con biometría) desde Perfil.
 *
 * Son SOLO de gestión: el alta y el login pasan por los route handlers
 * `/api/auth/webauthn/*` (necesitan cookies de desafío y respuesta binaria).
 */

/** Revoca una passkey (soft-delete): ese dispositivo deja de poder entrar. */
export async function eliminarCredencialWebauthn(id: number): Promise<void> {
  const userId = await requireUserId();
  const ds = await getDb();
  const repo = ds.getRepository(WebauthnCredential);

  const cred = await repo.findOne({
    where: { id, usuario: { id: userId }, eliminado: false },
  });
  if (!cred) throw new Error("Credencial no encontrada");

  cred.eliminado = true;
  await repo.save(cred);

  // Si justo era la passkey de ESTE dispositivo, se olvida la pista: el login
  // con biometría deja de ofrecerse acá (se vuelve a la contraseña).
  if ((await leerPistaCredencial()) === cred.credentialId) {
    await olvidarPistaCredencial();
  }

  revalidatePath("/perfil");
}

/** Renombra la passkey (etiqueta del dispositivo que se muestra en Perfil). */
export async function renombrarCredencialWebauthn(
  id: number,
  nombre: string
): Promise<void> {
  const userId = await requireUserId();
  const limpio = nombre.trim().slice(0, 80);
  if (!limpio) throw new Error("El nombre no puede estar vacío");

  const ds = await getDb();
  const repo = ds.getRepository(WebauthnCredential);

  const cred = await repo.findOne({
    where: { id, usuario: { id: userId }, eliminado: false },
  });
  if (!cred) throw new Error("Credencial no encontrada");

  cred.nombre = limpio;
  await repo.save(cred);
  revalidatePath("/perfil");
}
