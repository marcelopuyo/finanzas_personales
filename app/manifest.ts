import type { MetadataRoute } from "next";

/**
 * Web App Manifest (PWA): permite abrir la app en modo "standalone" desde el
 * Home Screen (iOS Safari) o "Instalar app" (Chrome/Android), ocultando las
 * barras de navegación del navegador. Next.js sirve este archivo en
 * /manifest.webmanifest y enlaza el <link rel="manifest"> automáticamente.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finanzas Personales",
    short_name: "Finanzas",
    description: "Gestión de finanzas personales",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#151517",
    theme_color: "#151517",
    icons: [
      // Favicon estándar + ícono de Apple (convenciones de Next: /icon.* y /apple-icon.*)
      { src: "/icon.png", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      // Tamaños requeridos por Chrome/Android para la instalación
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
