import type { Metadata, Viewport } from "next";
import { Inter, Unbounded } from "next/font/google";
import { cookies } from "next/headers";
import "flag-icons/css/flag-icons.min.css";
import ThemeProvider from "@/components/layout/theme-provider";
import { ToasterProvider } from "@/components/layout/toaster";
import { SessionGuard } from "@/components/auth/session-guard";
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
  other: {
    // Legacy de iOS: habilita el modo "app" al abrir desde el Home Screen.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full bg-background font-sans">
        <ThemeProvider>
          <SessionGuard />
          {children}
          <ToasterProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
