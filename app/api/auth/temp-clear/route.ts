import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/backend/src/lib/auth";

// Gracia de expiración: la cookie queda válida unos segundos para que un refresh
// (F5) alcance a renovarla antes de morir. Si nadie la renueva (pestaña cerrada),
// expira y el próximo ingreso pide login.
const GRACE_SECONDS = 5;

/**
 * Expira la cookie de sesión en GRACE_SECONDS segundos.
 * Lo invoca el cliente (fetch keepalive) desde `pagehide` cuando la sesión es
 * "no recordar": al cerrar la pestaña/navegador la cookie muere sola.
 */
export async function POST() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    store.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: GRACE_SECONDS,
    });
  }
  return NextResponse.json({ ok: true });
}
