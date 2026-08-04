import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui"],
  experimental: {
    // The authenticated /api proxy forwards local Files uploads to the API.
    // Next defaults this proxy buffer to 10 MB, while Files accepts up to 100 MB.
    proxyClientMaxBodySize: "100mb",
  },
}

export default nextConfig
