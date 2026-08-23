import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin({
  experimental: {
    // Tipa las claves a partir del idioma fuente: una clave inexistente falla
    // en typecheck en vez de renderizarse como texto crudo.
    createMessagesDeclaration: "./messages/es.json",
  },
})

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ]
  },
  experimental: {
    // The authenticated /api proxy forwards local Files uploads to the API.
    // Next defaults this proxy buffer to 10 MB, while Files accepts up to 100 MB.
    proxyClientMaxBodySize: "100mb",
  },
}

export default withNextIntl(nextConfig)
