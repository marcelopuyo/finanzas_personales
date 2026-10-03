/**
 * Estado **"la página ya se scrolleó"** para la top bar de **Inicio**
 * (2026-10-02, rama `rediseno-ui`).
 *
 * En Inicio la banda (hero) va **a sangre** y arranca en el borde superior, así
 * que en el top la top bar tiene que ser **transparente** para que la banda se vea
 * continua (sin borde ni cambio de tono). Apenas el usuario scrollea, la barra
 * **se despega**: pasa a **semitransparente con blur** y aparece su línea inferior.
 *
 * El estado vive como una **clase en el `<html>`** (`fp-inicio-scrolled`), no en un
 * store de módulo: la barra se monta en el **layout** y la página en el **route**, y
 * así no dependemos de que un módulo de estado sea la misma instancia en los dos
 * bundles. Es el mismo patrón que `fp-sin-red` (ver `globals.css`).
 */

const CLASE = "fp-inicio-scrolled";

/** La página marca/desmarca el scroll del tope en el `<html>`. */
export function setTopbarScrolled(v: boolean) {
  document.documentElement.classList.toggle(CLASE, v);
}
