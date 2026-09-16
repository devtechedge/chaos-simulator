import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Vercel does not use Next standalone output. Keep it for local `next start` only.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  typescript: {
    ignoreBuildErrors: false,
  },
  // Chaos intervals live in useEffect; Strict Mode would double-fire them in dev.
  reactStrictMode: false,
  skipTrailingSlashRedirect: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // No rewrites. The dashboard is a client-side simulation and ships no
  // backend. An earlier revision proxied /socket.io/* to a local Bun engine
  // on :3030; Vercel's serverless runtime cannot host a long-lived socket
  // server, so that rule was dead config and has been removed.

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },

};

export default nextConfig;
