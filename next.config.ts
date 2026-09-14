import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
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
