import { NextResponse, type NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import {
  IDLE_MAX_SEGUNDOS,
  RENOVAR_CADA_SEGUNDOS,
  ahoraSegundos,
  segundosSinActividad,
} from "@/lib/session-idle";

// Proxy de autenticación (Next 16: middleware.ts → proxy.ts): valida el JWT en
// la cookie `auth_token`, protege todas las rutas excepto /login, /register y
// /api/auth/*, y aplica la **ventana de inactividad** de la sesión (1 h) con
// renovación deslizante. Las páginas bajo (app) además se autoprotegen en su
// layout; esto es defensa en profundidad + redirección temprana.
//
// ⚠️ Este archivo NO importa `backend/src/lib/auth.ts`: arrastraría la BD (y
// `next/headers`) al runtime del proxy. Por eso el nombre de la cookie, el
// secreto y la FIRMA del token se repiten acá: si cambia el formato del token,
// hay que cambiarlo en los dos lados. Lo único compartido es `lib/session-idle.ts`,
// que es puro (constantes).

const COOKIE_NAME = "auth_token";
const PUBLIC_PATHS = ["/login", "/register"];

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Falta JWT_SECRET en .env.local");
  return new TextEncoder().encode(secret);
}

interface SesionValida {
  userId: number;
  remember: boolean;
  /** Última actividad (claim `act`; `iat` en tokens viejos), epoch segundos. */
  actividad: number;
  /** Vencimiento absoluto (claim `exp`), epoch segundos. */
  expira: number;
}

type EstadoSesion =
  | { tipo: "sin-sesion" }
  | { tipo: "invalida" }
  | { tipo: "inactiva" }
  | { tipo: "valida"; sesion: SesionValida; renovar: boolean };

/**
 * Estado de la sesión del request.
 *
 * `inactiva` = el token es válido pero la última actividad superó la ventana
 * (`IDLE_MAX_SEGUNDOS`): se considera cerrada la sesión (barrera que el usuario no
 * puede saltear desde el cliente, a diferencia del bloqueo de app).
 */
async function leerSesion(req: NextRequest): Promise<EstadoSesion> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return { tipo: "sin-sesion" };

  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(token, getSecret()));
  } catch {
    // Firma inválida o token vencido (exp absoluto).
    return { tipo: "invalida" };
  }

  const userId = Number(payload.sub);
  if (!Number.isFinite(userId) || payload.scope !== "access") {
    return { tipo: "invalida" };
  }

  const actividad = Number(payload.act ?? payload.iat ?? 0);
  const sinActividad = segundosSinActividad(actividad);
  // Sin dato de actividad no se cierra nada (defensivo): preferimos no dejar
  // afuera a alguien por un token sin el claim.
  if (sinActividad !== null && sinActividad > IDLE_MAX_SEGUNDOS) {
    return { tipo: "inactiva" };
  }

  return {
    tipo: "valida",
    sesion: {
      userId,
      remember: payload.recordar !== false,
      actividad,
      expira: Number(payload.exp ?? 0),
    },
    // Renovación DESLIZANTE: se reescribe la cookie solo si la actividad quedó
    // vieja (no en cada request, para no firmar tokens de más).
    renovar: sinActividad === null || sinActividad > RENOVAR_CADA_SEGUNDOS,
  };
}

/**
 * Reemite el token con la actividad de AHORA y la **misma expiración absoluta**
 * (la ventana de inactividad se corre, pero el techo de la sesión no se estira).
 */
async function renovarToken(sesion: SesionValida): Promise<string> {
  return new SignJWT({
    scope: "access",
    recordar: sesion.remember,
    act: ahoraSegundos(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(sesion.userId))
    .setIssuedAt()
    .setExpirationTime(sesion.expira)
    .sign(getSecret());
}

/** Opciones de la cookie de sesión, iguales a las de `setAuthCookie`. */
function opcionesDeCookie(remember: boolean, expira: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    // "Mantener la sesión": cookie persistente, alineada con lo que le queda al
    // token. Sesión normal: cookie de sesión (sin `maxAge`).
    ...(remember
      ? { maxAge: Math.max(1, expira - ahoraSegundos()) }
      : {}),
  };
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApiAuth = pathname.startsWith("/api/auth");
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  const estado = await leerSesion(req);
  const authed = estado.tipo === "valida";

  let res: NextResponse;
  if (isPublic || isApiAuth) {
    // Rutas públicas y API de auth: si ya hay sesión en /login|/register,
    // llevar al usuario a la app.
    res =
      authed && isPublic
        ? NextResponse.redirect(new URL("/dashboard", req.url))
        : NextResponse.next();
  } else if (authed) {
    res = NextResponse.next();
  } else {
    // Rutas protegidas: sin sesión válida (o con la ventana de inactividad
    // vencida) → /login.
    res = NextResponse.redirect(new URL("/login", req.url));
  }

  if (estado.tipo === "valida" && estado.renovar) {
    // Renovación deslizante: la actividad del request corre la ventana de
    // inactividad (misma expiración absoluta).
    res.cookies.set(
      COOKIE_NAME,
      await renovarToken(estado.sesion),
      opcionesDeCookie(estado.sesion.remember, estado.sesion.expira)
    );
  } else if (estado.tipo !== "valida" && estado.tipo !== "sin-sesion") {
    // Se cayó la sesión (token vencido/inválido o inactividad): se borra la
    // cookie para que el cliente no la siga viendo como sesión viva.
    res.cookies.delete(COOKIE_NAME);
  }

  return res;
}

export const config = {
  // Los estáticos de la PWA quedan FUERA del guard (2026-09-14): al evaluar si
  // la app es instalable, el navegador pide el manifest y los iconos (estos
  // últimos SIN credenciales), así que si el proxy los redirige a /login la
  // instalación falla de forma silenciosa. `/offline` también es público: se
  // muestra justamente cuando no hay red para validar la sesión. Y `api/ping`
  // es la SONDA del servidor (2026-09-17): tiene que contestar 204 siempre,
  // incluso sin sesión (se usa cuando la sesión no se puede validar).
  //
  // `voz-lab/sherpa/` (motor WASM de sherpa-onnx) y `voz-lab/modelo/` (pesos)
  // también quedan fuera (2026-09-22): son binarios inertes de ~103 MB que se
  // piden por fetch/XHR desde el runtime de Emscripten y por rangos; si el
  // guard los desviara a /login devolvería HTML en vez de bytes y quedaría un
  // 200 con contenido basura escrito en el FS del WASM. **La página del lab
  // (`/voz-lab` y `/voz-lab/piloto.html`) NO está excluida: sigue pidiendo
  // sesión.**
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon\\.svg|icon\\.png|apple-icon\\.png|manifest\\.webmanifest|sw\\.js|icons/|offline(?:$|/)|version\\.json|api/ping(?:$|/)|voz-lab/sherpa/|voz-lab/modelo/).*)",
  ],
};
