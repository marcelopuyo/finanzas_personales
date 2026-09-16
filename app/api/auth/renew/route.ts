import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  COOKIE_NAME,
  clearAuthCookie,
  setAuthCookie,
  verifyToken,
} from "@/backend/src/lib/auth";
import {
  IDLE_MAX_SEGUNDOS,
  segundosSinActividad,
} from "@/lib/session-idle";

/**
 * Renueva la cookie de sesión de una sesión "no recordar" como cookie de sesión.
 * Lo invoca el cliente al detectar un refresh (F5) en la misma pestaña, antes de
 * que expire la gracia dejada por `/api/auth/temp-clear`. Así recargar NO desloguea.
 *
 * ⚠️ NO revive una sesión caída por INACTIVIDAD: si la ventana venció, renovar
 * sería justamente el agujero que el idle timeout quiere cerrar (una pestaña
 * abandonada + F5 = sesión nueva sin contraseña).
 */
export async function POST() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    const payload = await verifyToken(token);
    if (payload?.scope === "access") {
      const sinActividad = segundosSinActividad(payload.actividad);
      if (sinActividad !== null && sinActividad > IDLE_MAX_SEGUNDOS) {
        await clearAuthCookie();
        return NextResponse.json({ ok: false, motivo: "inactividad" });
      }
      await setAuthCookie(payload.userId, false);
      return NextResponse.json({ ok: true });
    }
  }
  return NextResponse.json({ ok: false });
}
