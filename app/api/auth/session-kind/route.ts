import { NextResponse } from "next/server";
import { getSessionKind } from "@/backend/src/lib/auth";

/**
 * Tipo de la sesión actual (`none` | `temporal` | `persistente`).
 *
 * Lo usa `SessionGuard` en cada arranque de la app: si la sesión es `temporal`
 * (el usuario NO marcó "mantener la sesión") y esta pestaña/app no tiene el flag
 * de sesión, esa cookie es una **sobra de un cierre anterior** (iOS conserva las
 * cookies de sesión) y hay que cerrarla para que vuelva a pedirse el ingreso.
 *
 * Es una ruta de `/api/auth/*` ⇒ pública para el proxy y la lee tanto el cliente
 * logueado como el que no.
 */
export async function GET() {
  const estado = await getSessionKind();
  return NextResponse.json(
    { estado },
    { headers: { "Cache-Control": "no-store" } }
  );
}
