"use server";

import { z } from "zod";
import { getDb } from "../db";
import { requireUserId, verifyPassword, hashPassword } from "../lib/auth";
import { refresh } from "../lib/action-helpers";
import { Usuario } from "../entities/usuario.entity";
import { Moneda } from "../entities/moneda.entity";

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

// ---------------------------------------------------------------- moneda
const monedaPredeterminadaSchema = z.object({
  monedaId: z.number().int().positive(),
});

/** Actualiza la moneda predeterminada del usuario (desde el perfil). */
export async function actualizarMonedaPredeterminada(
  input: z.infer<typeof monedaPredeterminadaSchema>
) {
  const userId = await requireUserId();
  const data = monedaPredeterminadaSchema.parse(input);

  const ds = await getDb();
  const moneda = await ds.getRepository(Moneda).findOneBy({
    id: data.monedaId,
    eliminado: false,
  });
  if (!moneda) throw new Error("Moneda no encontrada");

  const usuario = await ds.getRepository(Usuario).findOneBy({ id: userId });
  if (!usuario) throw new Error("Usuario no encontrado");

  usuario.monedaPredeterminada = moneda;
  await ds.getRepository(Usuario).save(usuario);
  refresh();

  return { ok: true };
}
