import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

/**
 * Servicio de envío de emails con `nodemailer`.
 *
 * - Si hay SMTP configurado (`SMTP_HOST`) → envía por ese servidor (producción
 *   o cualquier SMTP real: hosting, dominio, Gmail, etc.).
 * - Si NO hay SMTP → usa una cuenta Ethereal temporal (solo desarrollo): el
 *   correo NO sale de verdad, pero se puede ver en https://ethereal.email (la
 *   URL de preview la devuelve `enviarEmailVerificacion`).
 */

/** URL pública de la app, para armar links dentro de los emails. */
function getAppUrl(): string {
  return (
    process.env.APP_URL ||
    (process.env.NODE_ENV === "production"
      ? ""
      : `http://localhost:${process.env.PORT ?? 3001}`)
  );
}

let etherealTransporter: Promise<Transporter> | null = null;

async function getTransporter(): Promise<Transporter> {
  const host = process.env.SMTP_HOST;
  if (host) {
    return nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }

  // Ethereal (dev): se crea una cuenta temporal una sola vez y se reutiliza.
  etherealTransporter ??= nodemailer.createTestAccount().then((acc) =>
    nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: acc.user, pass: acc.pass },
    })
  );
  return etherealTransporter;
}

export interface EnvioVerificacionResult {
  /** true si el mail se envió por SMTP/Ethereal. */
  enviado: boolean;
  /** URL de preview del mail en Ethereal (solo cuando no hay SMTP configurado). */
  previewUrl?: string;
}

/** Envía el correo de verificación de email y devuelve info útil para el front. */
export async function enviarEmailVerificacion(
  email: string,
  token: string
): Promise<EnvioVerificacionResult> {
  const link = `${getAppUrl()}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const transporter = await getTransporter();
  const from =
    process.env.SMTP_FROM ?? "Finanzas Personales <no-reply@finanzas.local>";

  const info = await transporter.sendMail({
    from,
    to: email,
    subject: "Verificá tu email — Finanzas Personales",
    text:
      `Hola!\n\nPara terminar de crear tu cuenta, confirmá tu email abriendo este enlace:\n\n` +
      `${link}\n\n` +
      `Si no pediste esta cuenta, podés ignorar este mensaje.`,
    html:
      `<div style="font-family:Inter,Arial,sans-serif;background:#151517;padding:24px;color:#f0f1f2">` +
      `<div style="max-width:480px;margin:0 auto;background:#1b1b1c;border:1px solid #3e3f42;border-radius:12px;padding:24px">` +
      `<h2 style="margin:0 0 12px;font-size:18px;color:#ffffff">Confirmá tu email</h2>` +
      `<p style="font-size:14px;color:#9a9b9e;line-height:1.5">` +
      `Para terminar de crear tu cuenta en <strong style="color:#f0f1f2">Finanzas Personales</strong>, hacé clic en el botón:</p>` +
      `<p style="text-align:center;margin:20px 0">` +
      `<a href="${link}" style="display:inline-block;background:#4c6ef5;color:#ffffff;padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">Verificar email</a>` +
      `</p>` +
      `<p style="font-size:12px;color:#808185">Si el botón no funciona, copiá este enlace en tu navegador:<br>` +
      `<a href="${link}" style="color:#4c6ef5;word-break:break-all">${link}</a></p>` +
      `<p style="font-size:12px;color:#808185;margin-top:16px">Si no pediste esta cuenta, podés ignorar este mensaje.</p>` +
      `</div></div>`,
  });

  const testUrl = nodemailer.getTestMessageUrl(info);
  const previewUrl = typeof testUrl === "string" ? testUrl : undefined;
  return { enviado: true, previewUrl };
}
