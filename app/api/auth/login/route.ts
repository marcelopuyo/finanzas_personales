import { NextResponse } from "next/server";
import { loginSchema } from "@/backend/src/validation/auth";
import { setAuthCookie, verifyPassword } from "@/backend/src/lib/auth";
import {
  findUsuarioByEmail,
  usuarioToOut,
} from "@/backend/src/queries/usuarios";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.parse(body);

    const usuario = await findUsuarioByEmail(parsed.email);
    if (!usuario || !(await verifyPassword(parsed.password, usuario.passwordHash))) {
      return NextResponse.json(
        { ok: false, error: "Credenciales inválidas" },
        { status: 401 }
      );
    }
    if (!usuario.activo) {
      return NextResponse.json(
        { ok: false, error: "La cuenta está desactivada" },
        { status: 403 }
      );
    }
    if (!usuario.emailVerificado) {
      return NextResponse.json(
        {
          ok: false,
          error: "Debes verificar tu email antes de operar",
          requiereVerificacion: true,
        },
        { status: 403 }
      );
    }

    await setAuthCookie(usuario.id);
    return NextResponse.json({ ok: true, usuario: usuarioToOut(usuario) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 400 }
    );
  }
}
