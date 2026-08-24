import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin({
  experimental: {
    createMessagesDeclaration: "./messages/es.json",
  },
})

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  typescript: { ignoreBuildErrors: true },
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
