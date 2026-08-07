// Preferencia de tema claro/oscuro persistida en una COOKIE.
// Se lee en cada ingreso a la aplicación (server + script pre-hidratación) para
// aplicar el tema sin parpadeo, y se escribe al cambiarlo desde el cliente.

export type Theme = "light" | "dark";

export const THEME_COOKIE = "theme";
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 año

/** Lee el tema desde la cookie (solo cliente). */
export function readThemeCookie(): Theme | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((r) => r.startsWith(`${THEME_COOKIE}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.split("=").slice(1).join("="));
  return value === "dark" || value === "light" ? value : null;
}

/** Escribe el tema en la cookie (solo cliente). */
export function writeThemeCookie(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
}
