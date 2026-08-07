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
    // No existe / contraseña incorrecta / usuario "eliminado" (soft-delete):
    // misma leyenda genérica, sin revelar si la cuenta existe o fue eliminada.
    if (
      !usuario ||
      !(await verifyPassword(parsed.password, usuario.passwordHash))
    ) {
      return NextResponse.json(
        { ok: false, error: "Los datos de inicio de sesión son incorrectos" },
        { status: 401 }
      );
    }
    if (usuario.eliminado) {
      return NextResponse.json(
        { ok: false, error: "Los datos de inicio de sesión son incorrectos" },
        { status: 401 }
      );
    }
    if (!usuario.activo) {
      return NextResponse.json(
        {
          ok: false,
          error: "Usuario inactivo. Comunicarse con el administrador del sistema.",
        },
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

    await setAuthCookie(usuario.id, parsed.recordar ?? false);
    return NextResponse.json({ ok: true, usuario: usuarioToOut(usuario) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 400 }
    );
  }
}
