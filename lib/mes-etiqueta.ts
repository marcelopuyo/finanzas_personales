/**
 * Etiquetas de mes del panel **Resultados** (`"sep-2026"`, `"sept-2026"`, …):
 * las genera el backend con `etiquetaDesdeYM` (`backend/src/queries/reportes.ts`,
 * mes corto es-ES + año).
 *
 * Este helper las vuelve **ordenables**: `"sep-2026"` **no** es una fecha que
 * `new Date()` pueda parsear y, como clave de un objeto, conserva el **orden de
 * inserción** (no el cronológico) ⇒ sin esto el eje X queda fuera de orden.
 *
 * Lo comparten el **gráfico** y el **listado** de Resultados — mismo criterio que
 * la serie: si cada uno ordenara por su cuenta, podrían discrepar.
 */

/** Meses abreviados de `etiquetaDesdeYM` (es-ES corto) → número. */
const MESES: Record<string, number> = {
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dic: 12,
};

/**
 * Clave numérica `AAAAMM` a partir de la etiqueta `"mes-aaaa"`.
 *
 * ⚠️ **Ojo con septiembre**: `toLocaleDateString("es-ES", { month: "short" })`
 * devuelve **`"sept"`** (4 letras, el único mes que no entra en 3) ⇒ se compara
 * por los **3 primeros caracteres**, que alcanzan para distinguir los 12 meses en
 * español. Una etiqueta que no matchee queda en `0` (se va al final).
 */
export function claveMesDesdeEtiqueta(etiqueta: string): number {
  const [mes = "", anio = ""] = etiqueta.split("-");
  const n = MESES[mes.slice(0, 3).toLowerCase()] ?? 0;
  const y = Number(anio);
  return Number.isFinite(y) ? y * 100 + n : 0;
}

/**
 * **Abrevia el año a 2 dígitos** en una etiqueta `"mes-aaaa"` (`"sep-2026"` →
 * `"sep-26"`): la usan los **rótulos del eje X** de los gráficos, donde el año
 * completo se come el ancho de los meses (2026-10-10).
 *
 * ⚠️ Lo que **no** sea `mes-aaaa` se devuelve **tal cual**: en los mismos gráficos
 * hay series **diarias** con etiquetas ISO (`"2026-09-10"`, sparklines de las
 * cuentas) que no se tocan.
 */
export function mesAnioCorto(etiqueta: string): string {
  const m = /^(\p{L}{3,4})-(\d{4})$/iu.exec(etiqueta);
  return m ? `${m[1]}-${m[2].slice(2)}` : etiqueta;
}
