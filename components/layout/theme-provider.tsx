"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useSyncExternalStore,
} from "react";
import {
  readThemeCookie,
  writeThemeCookie,
  type Theme,
} from "@/lib/theme";

export type { Theme } from "@/lib/theme";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

/** Clave del tema en localStorage (versión anterior, sólo para migrar). */
const TEMA_LEGACY_KEY = "theme";

function leerTemaLegacy(): Theme | null {
  if (typeof localStorage === "undefined") return null;
  const guardado = localStorage.getItem(TEMA_LEGACY_KEY);
  return guardado === "dark" || guardado === "light" ? guardado : null;
}

/** Preferencia del sistema operativo (sólo cliente). */
function temaDelSistema(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Snapshot del tema: cookie → localStorage legacy → preferencia del sistema.
 * Debe ser PURO (no escribe) y devolver siempre el mismo valor mientras nada
 * cambie: `useSyncExternalStore` lo llama en cada render y en cada chequeo.
 */
function leerTema(): Theme {
  return readThemeCookie() ?? leerTemaLegacy() ?? temaDelSistema();
}

// Mini store externo sobre la cookie del tema: `useSyncExternalStore` es la
// forma soportada de leer un sistema externo (la cookie) sin `setState` dentro
// de un efecto.
const suscriptores = new Set<() => void>();

function suscribirTema(suscriptor: () => void) {
  suscriptores.add(suscriptor);
  return () => {
    suscriptores.delete(suscriptor);
  };
}

function emitirTema() {
  suscriptores.forEach((suscriptor) => suscriptor());
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // `null` = todavía no conocemos el tema del usuario (SSR e hidratación): el
  // primer render usa "light", igual que el HTML del servidor, y React
  // re-renderiza con el tema real apenas termina la hidratación (la clase del
  // <html> ya la puso el script del <head> antes del primer paint).
  const temaCliente = useSyncExternalStore(suscribirTema, leerTema, () => null);
  const theme: Theme = temaCliente ?? "light";

  // Aplica el tema al <html> y persiste la cookie (migra el localStorage viejo
  // y deja registrada la preferencia del sistema si no había ninguna).
  useEffect(() => {
    if (temaCliente === null) return;
    document.documentElement.classList.toggle("dark", temaCliente === "dark");
    writeThemeCookie(temaCliente);
  }, [temaCliente]);

  const setTheme = useCallback((tema: Theme) => {
    writeThemeCookie(tema);
    emitirTema();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
