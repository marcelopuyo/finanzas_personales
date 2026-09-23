import { redirect } from "next/navigation";
import { parsearIntencion } from "@/lib/voz/parse-intencion";
import { SinIntencion } from "./sin-intencion";

/**
 * Entrada de dictado **por URL**: `/voz?t=<texto>`.
 *
 * Es la puerta que usa el **Atajo de Apple** (dictar con el micrófono del sistema
 * y abrir esta URL) y, más adelante, el botón flotante global. Existe porque en
 * **iOS Safari el micrófono web no sirve** para uso repetido: funciona una sola
 * vez por carga de página (ver el plan, "Veredicto de F0.5").
 *
 * Flujo:
 * 1. Se interpreta la **intención** del texto (`parsearIntencion`).
 * 2. Si hay intención → se navega a su destino llevando el **texto sobrante** en
 *    `?dicho=`. ⚠️ **Hoy nadie lo consume** (2026-09-23): el llenado por voz de la
 *    pantalla vuelve con el **FAB 🎤** (§14 del plan, fases G1/G3). El param viaja
 *    como **transporte previsto**, no como campo de UI — el panel de texto +
 *    "Interpretar" se retiró.
 * 3. Si no hay intención → **no se navega**: se muestra qué se escuchó.
 *
 * El parser es puro, así que corre en el servidor y el redirect no depende de JS
 * en el cliente.
 */
export const dynamic = "force-dynamic";

export default async function VozPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const texto = (t ?? "").trim();

  if (!texto) redirect("/dashboard");

  const { intencion, resto } = parsearIntencion(texto);
  if (!intencion) return <SinIntencion texto={texto} />;

  const dicho = resto ? `?dicho=${encodeURIComponent(resto)}` : "";
  redirect(`${intencion.href()}${dicho}`);
}
