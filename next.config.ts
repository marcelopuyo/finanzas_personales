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
  },
};

export default nextConfig;
