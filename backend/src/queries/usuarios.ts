import { getDb } from "../db";
import { Usuario } from "../entities/usuario.entity";

// Acceso a la tabla `usuario` (usado por los endpoints de auth).

export type UsuarioOut = {
  id: number;
  email: string;
  nombre: string | null;
  emailVerificado: boolean;
  activo: boolean;
};

function toOut(u: Usuario): UsuarioOut {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre ?? null,
    emailVerificado: u.emailVerificado,
    activo: u.activo,
  };
}

export async function findUsuarioByEmail(email: string): Promise<Usuario | null> {
  const ds = await getDb();
  return ds.getRepository(Usuario).findOneBy({ email });
}

export async function findUsuarioById(id: number): Promise<Usuario | null> {
  const ds = await getDb();
  return ds.getRepository(Usuario).findOneBy({ id });
}

export async function createUsuario(
  email: string,
  passwordHash: string,
  nombre?: string
): Promise<UsuarioOut> {
  const ds = await getDb();
  const usuario = await ds.getRepository(Usuario).save(
    ds.getRepository(Usuario).create({
      email,
      passwordHash,
      nombre,
      emailVerificado: false,
      activo: true,
    })
  );
  return toOut(usuario);
}

/** Marca el email como verificado. Devuelve true si existía el usuario. */
export async function marcarEmailVerificado(id: number): Promise<boolean> {
  const ds = await getDb();
  const usuario = await ds.getRepository(Usuario).findOneBy({ id });
  if (!usuario) return false;
  usuario.emailVerificado = true;
  await ds.getRepository(Usuario).save(usuario);
  return true;
}

export { toOut as usuarioToOut };
