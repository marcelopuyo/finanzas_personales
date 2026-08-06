import { NextResponse } from "next/server";
import { registerSchema } from "@/backend/src/validation/auth";
import { hashPassword, signToken } from "@/backend/src/lib/auth";
import { enviarEmailVerificacion } from "@/backend/src/lib/email";
import {
  createUsuario,
  findUsuarioByEmail,
} from "@/backend/src/queries/usuarios";

/**
 * Registro abierto (decisión 2026-08-06): cualquiera crea su cuenta.
 * Requiere verificar el email antes de poder operar.
 *
 * El email de verificación se envía con `nodemailer`:
 *  - Con SMTP configurado (SMTP_HOST) → correo real (producción/hosting).
 *  - Sin SMTP → Ethereal (dev), se devuelve `previewUrl` para verlo.
 *  - Si el envío falla en dev → se devuelve `devVerifyUrl` (link directo).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.parse(body);

    const existe = await findUsuarioByEmail(parsed.email);
    if (existe) {
      return NextResponse.json(
        { ok: false, error: "El email ya está registrado" },
        { status: 400 }
      );
    }

    const hash = await hashPassword(parsed.password);
    const usuario = await createUsuario(parsed.email, hash, parsed.nombre);

    // Token de verificación de email (scope "verify", 24h).
    const verifyToken = await signToken(usuario.id, "verify");

    let previewUrl: string | undefined;
    let devVerifyUrl: string | undefined;
    try {
      const r = await enviarEmailVerificacion(parsed.email, verifyToken);
      previewUrl = r.previewUrl;
    } catch {
      // No se pudo enviar (sin SMTP ni conexión a Ethereal). Solo en dev se
      // expone el link directo para no bloquear el flujo de prueba.
      if (process.env.NODE_ENV !== "production") {
        const base = `http://localhost:${process.env.PORT ?? 3001}`;
        devVerifyUrl = `${base}/api/auth/verify?token=${verifyToken}`;
      }
    }

    return NextResponse.json({
      ok: true,
      usuario,
      previewUrl,
      devVerifyUrl,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 400 }
    );
  }
}
