/**
 * Versión de la aplicación.
 *
 * Los valores los inyecta `next.config.ts` en el build (variables `env` de Next,
 * que el bundler reemplaza por LITERALES), así que están disponibles igual en
 * servidor y en cliente sin importar `package.json` al bundle.
 *
 * Reglas de versionado (2026-09-15):
 * - Fuente única: `version` de `package.json` (SemVer) + el commit del deploy.
 * - Al publicar un lote: subir `version` en `package.json` (y listo: los tags de
 *   git `vX.Y.Z` quedaron EN PAUSA por decisión del usuario, 2026-09-18).
 * - `APP_BUILD_ID` identifica al BUILD (versión + commit): lo usa el service
 *   worker para detectar que hay un deploy nuevo y descartar los documentos
 *   cacheados de la versión anterior (ver `sincronizarBuild()` en `public/sw.js`).
 */

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "v0.0.0";
export const APP_COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT ?? "local";
export const APP_BUILD_ID = process.env.NEXT_PUBLIC_APP_BUILD_ID ?? "sin-version";
export const APP_BUILT_AT = process.env.NEXT_PUBLIC_APP_BUILT_AT ?? "";

/**
 * Fecha del build en dd/mm/aaaa.
 *
 * Se corta el string ISO a mano (sin `new Date()` + `toLocaleDateString`): el
 * valor es un literal del build, así que el servidor y el cliente tienen que
 * mostrar EXACTAMENTE lo mismo o la hidratación protesta por diferencia de zona.
 */
export function appBuiltAtDate(): string {
  const [year, month, day] = (APP_BUILT_AT.slice(0, 10) || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : "";
}

/** Texto para mostrar en la UI: "v1.0.0 · a3f1c08 · 15/09/2026". */
export function versionLabel(): string {
  return [APP_VERSION, APP_COMMIT, appBuiltAtDate()].filter(Boolean).join(" · ");
}
