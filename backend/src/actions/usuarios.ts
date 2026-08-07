"use server";

import type { z } from "zod";
import { getDb } from "../db";
import { hashPassword, requireAdmin, getSessionUser } from "../lib/auth";
import { dbError, refresh } from "../lib/action-helpers";
import { Usuario } from "../entities/usuario.entity";
import {
  findUsuarioByEmail,
  getUsuarioOut,
} from "../queries/usuarios";
import { usuarioCreateSchema, usuarioUpdateSchema } from "../validation/usuarios";

// ============================================================
// CRUD de usuarios — SOLO administradores (requireAdmin)
// ============================================================

export async function crearUsuarioAdmin(
  input: z.infer<typeof usuarioCreateSchema>
) {
  await requireAdmin();
  const data = usuarioCreateSchema.parse(input);
  const existe = await findUsuarioByEmail(data.email);
  if (existe) throw new Error("El email ya está registrado");

  const ds = await getDb();
  const hash = await hashPassword(data.password);
  try {
    // Creado por un admin → el email se considera verificado.
    const created = await ds.getRepository(Usuario).save(
      ds.getRepository(Usuario).create({
        email: data.email,
        passwordHash: hash,
        nombre: data.nombre,
        emailVerificado: true,
        activo: data.activo,
        esAdmin: data.esAdmin,
        eliminado: false,
      })
    );
    refresh();
    return getUsuarioOut(created.id);
  } catch (error) {
    dbError(error, "Usuario");
  }
}

export async function actualizarUsuarioAdmin(
  id: number,
  input: z.infer<typeof usuarioUpdateSchema>
) {
  await requireAdmin();
  const data = usuarioUpdateSchema.parse(input);
  const ds = await getDb();
  const repo = ds.getRepository(Usuario);
  const existing = await repo.findOneBy({ id });
  if (!existing) throw new Error(`Usuario con id ${id} no encontrado`);

  try {
    if (data.email !== undefined && data.email !== existing.email) {
      const conflict = await findUsuarioByEmail(data.email);
      if (conflict && conflict.id !== id) {
        throw new Error("El email ya está registrado");
      }
      existing.email = data.email;
    }
    if (data.nombre !== undefined) existing.nombre = data.nombre;
    if (data.emailVerificado !== undefined)
      existing.emailVerificado = data.emailVerificado;
    if (data.activo !== undefined) existing.activo = data.activo;
    if (data.esAdmin !== undefined) existing.esAdmin = data.esAdmin;
    if (data.password) {
      existing.passwordHash = await hashPassword(data.password);
    }
    await repo.save(existing);
    refresh();
    return getUsuarioOut(id);
  } catch (error) {
    dbError(error, "Usuario");
  }
}

export async function eliminarUsuarioAdmin(id: number) {
  await requireAdmin();
  const me = await getSessionUser();
  if (me?.id === id) {
    throw new Error("No podés eliminar tu propia cuenta");
  }

  const ds = await getDb();
  const repo = ds.getRepository(Usuario);
  const row = await repo.findOneBy({ id });
  if (!row) throw new Error(`Usuario con id ${id} no encontrado`);

  try {
    // Soft-delete: se marca eliminado=true en vez de borrar. Borrar haría
    // CASCADE por la FK usuarioId y eliminaría TODOS sus datos.
    row.eliminado = true;
    await repo.save(row);
    refresh();
  } catch (error) {
    dbError(error, "Usuario");
  }
}
