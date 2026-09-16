import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { getDb } from "../db";
import { Usuario } from "../entities/usuario.entity";
// Import relativo a propósito: `backend/` se compila también fuera de Next (CLI de
// migraciones con su propio tsconfig), donde el alias `@/` no está disponible.
import {
  IDLE_MAX_SEGUNDOS,
  ahoraSegundos,
  segundosSinActividad,
} from "../../../lib/session-idle";

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

/**
 * Firma un JWT corto con datos arbitrarios.
 *
 * Lo usa WebAuthn para guardar el **desafío** en una cookie httpOnly firmada
 * (así el cliente no puede elegirlo y no hay replay): ver `lib/webauthn.ts`.
 */
export async function signShortToken(
  data: Record<string, unknown>,
  expiresIn = "5m"
): Promise<string> {
  return new SignJWT(data)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

/** Verifica un JWT corto y devuelve sus datos (o null si es inválido/venció). */
export async function verifyShortToken<T = Record<string, unknown>>(
  token: string
): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as T;
  } catch {
    return null;
  }
}

/**
 * Firma un JWT con el userId en el subject.
 *
 * `remember` viaja DENTRO del token: el cliente necesita saber si la sesión debe
 * morir con la pestaña (`false`) o sobrevivir al cierre de la app (`true`), y no
 * alcanza con mirar la cookie — iOS y las PWA conservan cookies "de sesión" entre
 * cierres (ver `getSessionKind`).
 *
 * `act` = ÚLTIMA ACTIVIDAD (epoch segundos). Lo usa el proxy para la ventana de
 * inactividad (1 h) con renovación deslizante: ver `lib/session-idle.ts`.
 */
export async function signToken(
  userId: number,
  scope: TokenScope = "access",
  expiresIn?: string,
  remember = false
): Promise<string> {
  return new SignJWT({ scope, recordar: remember, act: ahoraSegundos() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(expiresIn ?? (scope === "refresh" ? "7d" : "24h"))
    .sign(getSecret());
}

/** Verifica un JWT y devuelve el payload, o null si es inválido/expirado. */
export async function verifyToken(token: string): Promise<{
  userId: number;
  scope: TokenScope;
  remember: boolean;
  /** Última actividad (epoch segundos); 0 si el token es viejo y no trae el claim. */
  actividad: number;
} | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const userId = Number(payload.sub);
    const scope = (payload.scope as TokenScope) ?? "access";
    if (!Number.isFinite(userId)) return null;
    // Los tokens emitidos antes de este cambio no traen el claim: se asumen
    // persistentes, para no cerrar sesiones "recordar" al actualizar.
    return {
      userId,
      scope,
      remember: payload.recordar !== false,
      // Fallback a `iat`: los tokens viejos tienen fecha de emisión, así que la
      // ventana de inactividad empieza a contar desde que se emitieron.
      actividad: Number(payload.act ?? payload.iat ?? 0),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- sesión
/**
 * Lee el JWT de la cookie y devuelve el userId autenticado (o null).
 *
 * Aplica la **ventana de inactividad** (1 h, `lib/session-idle.ts`). El proxy ya
 * la aplica para todas las rutas, pero esto es defensa en profundidad: las rutas
 * de `/api/auth/*` (p. ej. el desbloqueo con biometría) pasan por el proxy sin
 * control, así que sin este chequeo una sesión vencida por inactividad podría
 * seguir operando desde ahí.
 */
export async function getSessionUserId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (payload?.scope !== "access") return null;

  const sinActividad = segundosSinActividad(payload.actividad);
  if (sinActividad !== null && sinActividad > IDLE_MAX_SEGUNDOS) return null;

  return payload.userId;
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
  const token = await signToken(userId, "access", remember ? "30d" : "24h", remember);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    ...(remember ? { maxAge: REMEMBER_MAX_AGE_SECONDS } : {}),
  });
}

/**
 * Tipo de la sesión actual: `temporal` (sin "mantener la sesión"), `persistente`
 * (con "mantener la sesión") o `none`.
 *
 * Lo consulta `SessionGuard` en cada arranque. Es imprescindible porque el
 * navegador no alcanza para decidir: **iOS (y las PWAs instaladas) conservan las
 * cookies de sesión entre cierres**, así que una sesión "no recordar" puede
 * reaparecer en un arranque nuevo y dejar entrar sin contraseña ni biometría.
 */
export async function getSessionKind(): Promise<
  "none" | "temporal" | "persistente"
> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return "none";

  const payload = await verifyToken(token);
  if (!payload || payload.scope !== "access") return "none";
  return payload.remember ? "persistente" : "temporal";
}

/** Elimina la cookie de sesión (logout). */
export async function clearAuthCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
