import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Disable trailing-slash redirect so socket.io paths like `/socket.io/`
  // are not rewritten to `/socket.io` (which would break the connection).
  skipTrailingSlashRedirect: true,
  // Proxy socket.io requests to the chaos-engine mini-service on port 3030.
  // The dashboard connects with path `/socket.io/`, so we forward all
  // `/socket.io/*` requests to localhost:3030.
  async rewrites() {
    return [
      {
        source: "/socket.io/:path*",
        destination: "http://localhost:3030/socket.io/:path*",
      },
    ];
  },
};

export default nextConfig;
