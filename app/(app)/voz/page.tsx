import { redirect } from "next/navigation";
import {
  getCuentasParaVozSeguro,
  getVocabularioSeguro,
} from "@/backend/src/queries/voz";
import { DESTINOS_APRENDIBLES } from "@/lib/voz/intenciones";
import { parsearIntencion } from "@/lib/voz/parse-intencion";
import type { OpcionVoz } from "@/lib/voz/tipos";
import {
  aliasDeCatalogo,
  conceptosDeSistema,
  fusionarAprendidos,
} from "@/lib/voz/vocabulario";
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

  // Contexto de navegación: **las cuentas del usuario** (`ir-cuenta`) y sus
  // **órdenes aprendidas** (§15.6). Es la misma construcción que hace el FAB con
  // `useCuentasNavegables` / `useNavegacionAprendida`, pero acá en el servidor
  // (el parser es puro en los dos lados). Las dos consultas son capas opcionales
  // que **fallan abierto**.
  const [filas, cuentas] = await Promise.all([
    getVocabularioSeguro(),
    getCuentasParaVozSeguro(),
  ]);
  const sistema = conceptosDeSistema(filas);
  const opcionesCuenta: OpcionVoz[] = cuentas.map((c) => ({
    value: c.id,
    label: c.nombre,
  }));
  const aliasCuentas = fusionarAprendidos(
    aliasDeCatalogo(opcionesCuenta, sistema.cuenta ?? []),
    filas,
    opcionesCuenta,
    "cuenta"
  );
  const monedas: Record<string, string> = {};
  for (const c of cuentas) monedas[c.id] = c.moneda;
  const navegacion = fusionarAprendidos(
    new Map(),
    filas,
    DESTINOS_APRENDIBLES.map((i) => ({ value: i.id, label: i.etiqueta ?? i.id })),
    "navegacion"
  );

  const { intencion, resto, dato } = parsearIntencion(texto, {
    cuentas: { alias: aliasCuentas, monedas, opciones: opcionesCuenta },
    navegacion,
  });
  // Sin intención —o con un destino que necesita un dato que no se pudo resolver
  // (cuenta ambigua)— no se navega: se muestra qué se escuchó.
  if (!intencion || (intencion.dato && !dato)) return <SinIntencion texto={texto} />;

  // Sólo las intenciones que **dejan texto** arrastran el sobrante (F4 del QA):
  // en una orden de navegación el resto es ruido ("andá al resumen" → "al") y el
  // FAB lo interpretaría como campos a llenar en la pantalla destino.
  const dicho =
    intencion.llevaTexto && resto ? `?dicho=${encodeURIComponent(resto)}` : "";
  redirect(`${intencion.href(dato)}${dicho}`);
}
