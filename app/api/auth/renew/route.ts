import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, setAuthCookie, verifyToken } from "@/backend/src/lib/auth";

/**
 * Renueva la cookie de sesión de una sesión "no recordar" como cookie de sesión.
 * Lo invoca el cliente al detectar un refresh (F5) en la misma pestaña, antes de
 * que expire la gracia dejada por `/api/auth/temp-clear`. Así recargar NO desloguea.
 */
export async function POST() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload?.scope === "access") {
      await setAuthCookie(payload.userId, false);
      return NextResponse.json({ ok: true });
    }
  }
  return NextResponse.json({ ok: false });
}
