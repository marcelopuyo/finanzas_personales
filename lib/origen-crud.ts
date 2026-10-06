/**
 * **Origen de navegación de los CRUD** (`?origen=<vista>`): desde qué **vista del
 * dashboard** se abrió el listado. De acá salen las dos cosas que dependen de eso:
 *
 * · `volverDeOrigen` → destino de la **flecha "volver"** (‹) del listado.
 * · `sufijoOrigen`   → el `?origen=…` que se **propaga a Nuevo/Editar**, para que
 *   cancelar/guardar vuelvan al listado sin perder la flecha.
 *
 * 🔑 Se usa un **mapa** y no un `if` por vista: agregar una vista nueva es una
 * línea. Un origen **desconocido** (o ausente) ⇒ sin flecha y sin propagación, así
 * una URL vieja o escrita a mano nunca manda a un lugar arbitrario.
 *
 * ⚠️ `dashboard` es el **nombre histórico** del parámetro para la vista **Inicio**
 * (`/dashboard`) y sigue valiendo: los enlaces que ya lo usaban no cambian.
 */
export const VOLVER_POR_VISTA: Record<string, string> = {
  dashboard: "/dashboard", // Inicio
  gastos: "/dashboard/gastos",
  ingresos: "/dashboard/ingresos",
  prestamos: "/dashboard/prestamos",
};

/** Ruta a la que vuelve la flecha del CRUD abierto desde esa vista (`undefined` ⇒ sin flecha). */
export function volverDeOrigen(origen?: string | null): string | undefined {
  return origen ? VOLVER_POR_VISTA[origen] : undefined;
}

/** `?origen=<vista>` que conserva el origen al ir a Nuevo/Editar (`""` si no se reconoce). */
export function sufijoOrigen(origen?: string | null): string {
  return volverDeOrigen(origen) ? `?origen=${origen}` : "";
}

/** ¿Es una ruta interna segura (`/algo`, no `//host`)? */
function esRutaInterna(url?: string | null): url is string {
  return !!url && url.startsWith("/") && !url.startsWith("//");
}

/**
 * `?volverA=<url>` para que un formulario del CRUD vuelva a una URL concreta.
 * Lo usa el listado **embebido** en una pantalla (p. ej. `/dashboard/prestamos`):
 * sin esto, Editar/Nuevo/Cobrar volvían al CRUD suelto `/cruds/prestamos`.
 * Devuelve `""` si la URL no es una ruta interna.
 */
export function sufijoVolverA(url?: string | null): string {
  return esRutaInterna(url) ? `?volverA=${encodeURIComponent(url)}` : "";
}

/**
 * Destino de **Cancelar / guardar** de un formulario del CRUD: si viene
 * `volverA` (retorno explícito del listado embebido) manda esa URL; si no, el
 * listado del CRUD conservando el `origen`.
 */
export function destinoFormularioCrud(
  urlCrud: string,
  origen?: string | null,
  volverA?: string | null
): string {
  return esRutaInterna(volverA) ? volverA : `${urlCrud}${sufijoOrigen(origen)}`;
}
