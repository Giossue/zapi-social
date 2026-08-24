import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"
import { fileURLToPath } from "node:url"

const withNextIntl = createNextIntlPlugin({
  experimental: {
    createMessagesDeclaration: "../../packages/contracts/src/messages/es.json",
  },
})

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
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
    proxyClientMaxBodySize: "100mb",
  },
}

export default withNextIntl(nextConfig)
