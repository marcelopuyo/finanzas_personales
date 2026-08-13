import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getDb } from "../db";
import { Usuario } from "../entities/usuario.entity";

/**
 * Helpers de autenticación multiusuario.
 * - Hashing de contraseñas con bcrypt (nunca texto plano).
 * - JWT firmados con `jose` (HS256) usando `JWT_SECRET` de `.env.local`.
 * - La sesión se guarda en una cookie httpOnly (`auth_token`), inmune a XSS.
 *
 * El proxy (`proxy.ts`, Next 16) valida el JWT y redirige a /login en rutas
 * protegidas; aquí los Server Components/Actions leen la cookie directamente
 * para obtener el userId (fuente de verdad de la sesión).
 */

const COOKIE_NAME = "auth_token";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Falta JWT_SECRET en .env.local");
  }
  return new TextEncoder().encode(secret);
}

// ---------------------------------------------------------------- passwords
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// --------------------------------------------------------------------- JWT
export type TokenScope = "access" | "refresh" | "verify";

/** Firma un JWT con el userId en el subject. */
export async function signToken(
  userId: number,
  scope: TokenScope = "access",
  expiresIn?: string
): Promise<string> {
  return new SignJWT({ scope })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(expiresIn ?? (scope === "refresh" ? "7d" : "24h"))
    .sign(getSecret());
}

/** Verifica un JWT y devuelve el payload, o null si es inválido/expirado. */
export async function verifyToken(
  token: string
): Promise<{ userId: number; scope: TokenScope } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = Number(payload.sub);
    const scope = (payload.scope as TokenScope) ?? "access";
    if (!Number.isFinite(userId)) return null;
    return { userId, scope };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- sesión
/** Lee el JWT de la cookie y devuelve el userId autenticado (o null). */
export async function getSessionUserId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.scope === "access" ? payload.userId : null;
}

/** Para Server Components/Actions: lanza error si no hay sesión. */
export async function requireUserId(): Promise<number> {
  const userId = await getSessionUserId();
  if (!userId) throw new Error("No autenticado");
  return userId;
}

/** Devuelve el usuario autenticado completo (o null si no hay sesión). */
export async function getSessionUser(): Promise<Usuario | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const ds = await getDb();
  // Excluye usuarios "eliminados" (soft-delete): su sesión deja de ser válida.
  // Carga `monedaPredeterminada` (la usa el perfil y el dashboard).
  return ds.getRepository(Usuario).findOne({
    where: { id: userId, eliminado: false },
    relations: { monedaPredeterminada: true },
  });
}

/** True si el usuario autenticado tiene privilegios de administrador. */
export async function isAdmin(): Promise<boolean> {
  const user = await getSessionUser();
  return user?.esAdmin === true;
}

/** Para Server Components/Actions: lanza error si el usuario no es admin. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Se requieren privilegios de administrador");
  }
}

// ----------------------------------------------------------------- cookies
// Duración de la sesión "mantener la sesión" (30 días). La sesión por defecto
// es una cookie sin maxAge (se borra al cerrar el navegador).
const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 días

/**
 * Setea la cookie httpOnly de sesión para un usuario autenticado.
 * - `remember=false`: cookie de sesión (sin maxAge) → se borra al cerrar el navegador.
 * - `remember=true`: cookie persistente por 30 días → reingreso automático al abrir el navegador.
 */
export async function setAuthCookie(
  userId: number,
  remember = false
): Promise<void> {
  const token = await signToken(userId, "access", remember ? "30d" : "24h");
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    ...(remember ? { maxAge: REMEMBER_MAX_AGE_SECONDS } : {}),
  });
}

/** Elimina la cookie de sesión (logout). */
export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
