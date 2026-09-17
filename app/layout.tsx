import type { Metadata, Viewport } from "next";
import { Inter, Unbounded } from "next/font/google";
import { cookies } from "next/headers";
import "flag-icons/css/flag-icons.min.css";
import ThemeProvider from "@/components/layout/theme-provider";
import { ToasterProvider } from "@/components/layout/toaster";
import { SessionGuard } from "@/components/auth/session-guard";
import { SessionExpiredWatcher } from "@/components/auth/session-expired-watcher";
import { AppLock } from "@/components/auth/app-lock";
import { SwRegister } from "@/components/pwa/sw-register";
import { biometriaParaBloqueo } from "@/backend/src/queries/webauthn";
import { THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

// Fuente del wordmark del logo ("finanzas") — Unbounded, elegida por el usuario (2026-08-09).
// Se expone como variable CSS para poder usarla también en Client Components.
const unbounded = Unbounded({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-unbounded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finanzas Personales",
  description: "Gestión de finanzas personales",
  applicationName: "Finanzas",
  // PWA: permite abrir la app en modo standalone (oculta las barras del
  // navegador en iOS y Android). El manifest vive en /app/manifest.ts y Next
  // lo enlaza automáticamente como <link rel="manifest">.
  manifest: "/manifest.webmanifest",
  // iOS: emite `mobile-web-app-capable` (estándar) + `apple-mobile-web-app-capable`
  // (legacy), el nombre bajo el ícono (`apple-mobile-web-app-title`, hoy salía del
  // <title>) y la barra de estado translúcida, que es la que permite el borde a
  // borde controlado por safe-area (ver AppLayout/TopBar).
  appleWebApp: {
    capable: true,
    title: "Finanzas",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // PWA standalone: el contenido ocupa también las áreas seguras (notch y barra
  // inferior). Sin esto iOS deja una banda muerta arriba; con esto, cada parte de
  // la chrome suma su `env(safe-area-inset-*)` (top bar, bottom bar, FAB).
  viewportFit: "cover",
  // Tema para la barra del navegador (Android) y el área de la barra de estado
  // en modo standalone (iOS), según el scheme del dispositivo.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#151517" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Leer la preferencia de tema desde la cookie en cada ingreso (server-side)
  const store = await cookies();
  const themeCookie = store.get(THEME_COOKIE)?.value;
  const isDark = themeCookie === "dark";

  // ¿Este dispositivo puede desbloquear con biometría? Gobierna el bloqueo de la
  // app al reanudar desde segundo plano (components/auth/app-lock.tsx): sin una
  // passkey del usuario en ESTE equipo el bloqueo no se arma.
  const bloqueoBiometrico = await biometriaParaBloqueo();

  return (
    <html
      lang="es"
      className={`${inter.variable} ${unbounded.variable} h-full antialiased${isDark ? " dark" : ""}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = null;
                  var parts = document.cookie.split('; ');
                  for (var i = 0; i < parts.length; i++) {
                    if (parts[i].indexOf('theme=') === 0) {
                      t = decodeURIComponent(parts[i].substring(6));
                      break;
                    }
                  }
                  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                  // Sin conexión: se avisa ANTES del primer paint para que el
                  // candado (que viene renderizado del servidor) no parpadee.
                  // Con esta clase, el CSS lo oculta: la app arranca en modo
                  // lectura (§96) sin ver ni un frame del cerrojo.
                  if (navigator.onLine === false) {
                    document.documentElement.classList.add('fp-sin-red');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full bg-background font-sans">
        <ThemeProvider>
          <SessionGuard />
          {/* Sesión vencida en una Server Action: `Next` redirige al /login y la
              acción nunca corre, así que el usuario veía un error genérico. Este
              parche detecta el redirect y manda a /login con el aviso. */}
          <SessionExpiredWatcher />
          {/* Bloqueo de la app (mobile, con biometría activada): si el equipo
              puede desbloquear, el candado se renderiza ACÁ (en el servidor) y
              **antes del contenido a propósito**: así el primer paint al abrir la
              app ya es la pantalla de bloqueo y no se ve ni un frame del
              dashboard mientras llega el resto del HTML (streaming). Mientras la
              app está desbloqueada no dibuja nada. */}
          <AppLock habilitado={bloqueoBiometrico} />
          {/* PWA: registra el service worker (solo producción) y avisa cuando hay
              una versión nueva. No dibuja nada. */}
          <SwRegister />
          {children}
          <ToasterProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
