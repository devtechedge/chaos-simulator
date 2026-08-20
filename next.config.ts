import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Type errors fail the build (ignoreBuildErrors was a template leftover).
  typescript: {
    ignoreBuildErrors: false,
  },
  // Chaos intervals live in useEffect; Strict Mode would double-fire them in dev.
  reactStrictMode: false,
  skipTrailingSlashRedirect: true,
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
