"use server";

import { z } from "zod";
import { getDb } from "../db";
import { requireUserId, verifyPassword, hashPassword } from "../lib/auth";
import { Usuario } from "../entities/usuario.entity";

// Cambio de contraseña del usuario autenticado (desde el panel de usuario).

const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1, "Ingresá tu contraseña actual"),
  passwordNueva: z
    .string()
    .min(8, "La contraseña nueva debe tener al menos 8 caracteres"),
});

export async function cambiarPassword(
  input: z.infer<typeof cambiarPasswordSchema>
) {
  const userId = await requireUserId();
  const data = cambiarPasswordSchema.parse(input);

  const ds = await getDb();
  const repo = ds.getRepository(Usuario);
  const usuario = await repo.findOneBy({ id: userId });
  if (!usuario) throw new Error("Usuario no encontrado");

  const valida = await verifyPassword(data.passwordActual, usuario.passwordHash);
  if (!valida) throw new Error("La contraseña actual es incorrecta");

  usuario.passwordHash = await hashPassword(data.passwordNueva);
  await repo.save(usuario);

  return { ok: true };
}
