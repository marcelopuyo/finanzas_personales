/**
 * Piezas **compartidas** por las pantallas dictables del wizard (plan de voz §16).
 *
 * Nacieron al cablear los flujos de **transferencia** y **ajuste de cuenta**: los dos
 * aplican el dictado igual (regla 7 + snapshot para deshacer + escribir en el wizard).
 *
 * ℹ️ `gasto-directo.tsx` conserva su propia copia porque tiene lógica extra (completa
 * categoría y monto con el **último gasto** de la descripción dictada).
 */

import type { ValoresPantalla } from "@/components/voz/dictado-pantalla";
import type { CampoDictable, ConfigDictado, ResultadoDictado } from "@/lib/voz/tipos";
import { todayLocalISODate } from "@/lib/utils";

/**
 * **Enlaces y artículos** de una orden hablada ("**de la** cuenta", "**en** menos
 * 500"). Van en el `relleno` de las configs que **no** tienen campo de Descripción: si
 * no, el FAB los reporta como *"No entendí: «ajustá la cuenta en»"*.
 *
 * ⚠️ No se marca el diccionario completo de `RELLENO_INICIAL`: incluye "con", que sí
 * puede ser parte de una descripción ("pizza con fede").
 */
export const ENLACES_ORDEN = [
  "de",
  "del",
  "a",
  "al",
  "en",
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "mi",
  "mis",
  "por",
];

/**
 * ¿El formulario **ya tiene** un valor en ese campo?
 *
 * 🔑 Es la mitad de la regla **7** de §15.4 (*"lo implícito no pisa"*): el dictado
 * sólo completa lo que está vacío. La **Fecha** cuenta como vacía mientras siga
 * siendo el día de hoy (es el valor inicial, no una decisión del usuario) ⇒ "gasté
 * 500 ayer" sigue actualizando la fecha, pero si el usuario la eligió a mano no se pisa.
 */
export function tieneValorEn(
  campo: CampoDictable,
  actuales: Record<string, unknown>
): boolean {
  const actual = actuales[campo.campo];
  if (actual === undefined || actual === null || actual === "" || actual === 0) {
    return false;
  }
  if (campo.tipo === "fecha") return String(actual) !== todayLocalISODate();
  return true;
}

/**
 * **`aplicar` estándar** de una pantalla del wizard.
 *
 * Filtra las asignaciones **implícitas** cuyo campo ya tenía valor (regla 7, y las
 * acumula en `omitidos` para que la burbuja lo avise), arma el snapshot del **"antes"**
 * de los campos que se van a tocar y **escribe** en el wizard.
 *
 * Devuelve el "antes" (lo que el FAB necesita para deshacer y para los chips).
 */
export function aplicarDictadoSimple(
  resultado: ResultadoDictado,
  config: ConfigDictado,
  actuales: Record<string, unknown>,
  escribir: (valores: ValoresPantalla) => void
): ValoresPantalla {
  const campoDe = (nombre: string) =>
    config.campos.find((c) => c.campo === nombre);

  const omitidos: string[] = [];
  const vigentes = resultado.asignaciones.filter((a) => {
    if (a.explicito) return true;
    const campo = campoDe(a.campo);
    if (!campo || !tieneValorEn(campo, actuales)) return true;
    omitidos.push(campo.etiqueta ?? campo.campo);
    return false;
  });

  const valores: Record<string, string | number> = {};
  for (const a of vigentes) valores[a.campo] = a.valor;

  const antes: ValoresPantalla = {};
  for (const campo of Object.keys(valores)) {
    antes[campo] = actuales[campo] as string | number | undefined;
  }
  escribir(valores);

  // El FAB arma los chips y el aviso con el resultado **filtrado**.
  resultado.asignaciones = vigentes;
  resultado.valores = valores;
  resultado.omitidos = omitidos;

  return antes;
}

/**
 * **`escribir` estándar** de una pantalla: valores sueltos que **no** pasan por el
 * parser (la ✕ de un chip, el candidato elegido, Deshacer) y el **"antes"** de esos
 * campos — así el chip que agrega el FAB al elegir un candidato también sabe a qué
 * valor volver.
 */
export function escribirEnPantalla(
  valores: ValoresPantalla,
  actuales: Record<string, unknown>,
  escribir: (valores: ValoresPantalla) => void
): ValoresPantalla {
  const antes: ValoresPantalla = {};
  for (const campo of Object.keys(valores)) {
    antes[campo] = actuales[campo] as string | number | undefined;
  }
  escribir(valores);
  return antes;
}
