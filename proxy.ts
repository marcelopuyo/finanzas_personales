import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Proxy de autenticación (Next 16: middleware.ts → proxy.ts): valida el JWT en
// la cookie `auth_token` y protege todas las rutas excepto /login, /register y
// /api/auth/*. Las páginas bajo (app) además se autoprotegen en su layout; esto
// es defensa en profundidad + redirección temprana.

const COOKIE_NAME = "auth_token";
const PUBLIC_PATHS = ["/login", "/register"];

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Falta JWT_SECRET en .env.local");
  return new TextEncoder().encode(secret);
}

async function isAuthed(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload.scope === "access";
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApiAuth = pathname.startsWith("/api/auth");
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  const authed = await isAuthed(req);

  // Rutas públicas y API de auth: si ya hay sesión en /login|/register,
  // llevar al usuario a la app.
  if (isPublic || isApiAuth) {
    if (authed && isPublic) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Rutas protegidas: sin sesión válida → /login.
  if (!authed) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon\\.svg|icon\\.png|apple-icon\\.png).*)",
  ],
};
