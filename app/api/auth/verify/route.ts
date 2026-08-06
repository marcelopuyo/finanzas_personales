import { NextResponse } from "next/server";
import { verifyToken } from "@/backend/src/lib/auth";
import { marcarEmailVerificado } from "@/backend/src/queries/usuarios";

/**
 * Verificación de email: recibe el token firmado (scope "verify") por query
 * string y marca el email como verificado. Redirige a /login.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Token faltante" },
      { status: 400 }
    );
  }

  const payload = await verifyToken(token);
  if (!payload || payload.scope !== "verify") {
    return NextResponse.redirect(
      new URL("/login?error=token-invalido", req.url)
    );
  }

  await marcarEmailVerificado(payload.userId);
  return NextResponse.redirect(new URL("/login?verificado=1", req.url));
}
