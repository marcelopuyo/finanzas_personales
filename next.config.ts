import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import pkg from "./package.json";

// ============================================================
// Versionado de la aplicación (2026-09-15)
// ------------------------------------------------------------
// Fuente única: `version` de package.json (SemVer) + el commit del deploy.
// Se inyectan como variables `env` de Next, que el bundler reemplaza por
// LITERALES: quedan disponibles igual en servidor y en cliente sin importar
// package.json al bundle. `lib/version.ts` las expone y `/version.json` las
// publica (lo usa el service worker para saber a qué build pertenecen sus
// cachés: ver `sincronizarBuild()` en public/sw.js).
//
// Al publicar un lote: subir `version` en package.json.
// (Los tags de git `vX.Y.Z` quedaron EN PAUSA: decisión del usuario, 2026-09-18.)
// ============================================================

/** Commit corto del deploy: en Vercel lo da el entorno; en local, git. */
function commitCorto(): string {
  const deVercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (deVercel) return deVercel.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "local";
  }
}

const APP_VERSION = `v${pkg.version}`;
const APP_COMMIT = commitCorto();

const nextConfig: NextConfig = {
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
    NEXT_PUBLIC_APP_COMMIT: APP_COMMIT,
    /** Identifica al BUILD (versión + commit): lo usa el SW para invalidar caché. */
    NEXT_PUBLIC_APP_BUILD_ID: `${APP_VERSION}-${APP_COMMIT}`,
    NEXT_PUBLIC_APP_BUILT_AT: new Date().toISOString(),
  },
  // Paquetes nativos de servidor que no deben empaquetarse en el bundle
  serverExternalPackages: ["pg", "typeorm", "nodemailer"],
  experimental: {
    // ⚠️ CRÍTICO para TypeORM en producción: Turbopack minifica los nombres de
    // clase y MUCHAS entidades quedan con el mismo nombre (ej. "i"), rompiendo
    // el `targetName` que TypeORM usa para ordenar dependencias al guardar
    // (errores "Entity metadata for s#X was not found" y "Cyclic dependency").
    // Con minify desactivado los nombres de clase se conservan y TypeORM
    // funciona estable en el bundle de producción.
    turbopackMinify: false,
    // Cache del ROUTER del cliente (Next 15+): por defecto `dynamic: 0`, o sea
    // que TODAS las páginas dinámicas (dashboard, CRUDs…) se vuelven a pedir al
    // servidor cada vez que se navega, incluso al volver con el botón atrás.
    // Con 30s, volver de un CRUD al dashboard es INSTANTÁNEO (reusa el payload
    // RSC) → menos esperas y menos pantallas de carga (decisión 2026-09-14).
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
