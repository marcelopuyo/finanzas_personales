/**
 * **"Llevame al panel X" de la pantalla actual** — canal entre el que **ordena**
 * (el FAB 🎤, que vive en `AppLayout`, por fuera del contenido) y el que
 * **scrollea** (la pantalla, hoy sólo el dashboard).
 *
 * Por qué existe (2026-09-25, reportado desde el celular): una orden de voz a un
 * panel del dashboard se atendía **navegando** a `/dashboard?panel=X`. Eso costaba
 * una ida al servidor (7 consultas + barra de carga) y además quedaba roto cuando
 * la URL **ya** era `?panel=X`: `router.push` a la misma URL es un no-op y el
 * dashboard sólo reacciona cuando **cambia** la prop `panel` ⇒ la orden "no hacía
 * nada". Con este canal la orden se resuelve **en el cliente**: un scroll, sin
 * navegación.
 *
 * 🔑 Es un store **a nivel de módulo** (igual que `nav-progress.tsx` para la barra
 * de progreso y `lib/voz/handoff.ts` para el texto sobrante): une a los dos sin
 * props, sin contextos y sin providers.
 *
 * 📍 **Se registra una sola pantalla** (el dashboard): la registración vive atada
 * al montaje, así que al salir de la pantalla el canal queda vacío y las órdenes
 * vuelven a navegar como siempre.
 */

/** Pide ir a un ancla (`"top"` o el `data-panel` de la pantalla). */
type IrAlPanel = (ancla: string) => void;

/** Quién sabe scrollear a un panel ahora mismo (`null` = nadie). */
let actual: IrAlPanel | null = null;

/**
 * La pantalla publica su manera de ir a un panel. Devuelve el **"baja"** para el
 * cleanup del efecto (no pisa una registración ajena si ya la reemplazó otra).
 */
export function registrarIrAlPanel(fn: IrAlPanel): () => void {
  actual = fn;
  return () => {
    if (actual === fn) actual = null;
  };
}

/**
 * Pide ir al panel. Devuelve `true` cuando **la pantalla actual lo atendió** (no
 * hay que navegar) y `false` cuando nadie sabe hacerlo ⇒ el llamador **navega**
 * como siempre (destino de otra pantalla, o dashboard sin montar).
 */
export function irAlPanel(ancla: string): boolean {
  if (!actual) return false;
  actual(ancla);
  return true;
}

/** Ancla del **tope** de la pantalla (lo que pide `ir-resumen` ya estando en él). */
export const ANCLA_TOPE = "top";
