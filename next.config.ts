import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Paquetes nativos de servidor que no deben empaquetarse en el bundle
  serverExternalPackages: ["mssql", "typeorm"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3333/api/:path*",
      },
    ];
  },
};

export default nextConfig;
