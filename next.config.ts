import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://raw.githubusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

// Caminho base (ex.: "/torneios" para reinocobblemon.com/torneios). Vazio = raiz do domínio.
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  ...(basePath ? { basePath } : {}),
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  webpack(config, { dev, isServer }) {
    // src/lib/db.ts usa o build WASM do Prisma (necessário nos Workers). Em `next dev`
    // o servidor roda em Node, onde o client padrão é o correto.
    if (dev && isServer) {
      const toNodeClient = ({ request }: { request?: string }, callback: (err?: null, result?: string) => void) =>
        request === "@prisma/client/wasm" ? callback(null, "commonjs @prisma/client") : callback();
      config.externals = [toNodeClient, ...(Array.isArray(config.externals) ? config.externals : [config.externals])];
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
        ],
      },
    ];
  },
};

export default nextConfig;

// Em `next dev`, expõe os bindings da Cloudflare (Hyperdrive usa localConnectionString)
if (process.env.NODE_ENV === "development" && process.env.DATABASE_URL === undefined) {
  import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
}
