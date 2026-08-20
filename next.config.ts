import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel does not use Next standalone output. Keep it for local `next start` only.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  typescript: {
    ignoreBuildErrors: false,
  },
  // Chaos intervals live in useEffect; Strict Mode would double-fire them in dev.
  reactStrictMode: false,
  skipTrailingSlashRedirect: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
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
