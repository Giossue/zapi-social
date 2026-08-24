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
  /**
   * `next build` vuelve a comprobar los tipos por su cuenta, y eso son 18 de los
   * 28 segundos que tardaba. Ya lo hace antes `bun run typecheck` sobre el
   * monorepo entero, que además cubre API y worker; repetirlo dentro de la
   * imagen alarga cada despliegue sin encontrar nada nuevo. Un error de
   * compilación o de resolución de módulo sigue rompiendo el build.
   *
   * La contrapartida: si alguien publica sin pasar `typecheck`, un error de
   * tipos llega a producción. Ver `docs/conocimiento/deployment/dokploy.md`.
   */
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
    // The authenticated /api proxy forwards local Files uploads to the API.
    // Next defaults this proxy buffer to 10 MB, while Files accepts up to 100 MB.
    proxyClientMaxBodySize: "100mb",
  },
}

export default withNextIntl(nextConfig)
