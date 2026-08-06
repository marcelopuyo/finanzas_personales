import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Paquetes nativos de servidor que no deben empaquetarse en el bundle
  serverExternalPackages: ["pg", "typeorm"],
};

export default nextConfig;
