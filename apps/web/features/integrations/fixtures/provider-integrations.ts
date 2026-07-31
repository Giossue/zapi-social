import type { IntegrationProvider } from "../types/integrations"

/** Datos locales y deterministas para la Fase A; no representan credenciales reales. */
export const providerIntegrations: IntegrationProvider[] = [
  {
    id: "meta",
    label: "Meta",
    description:
      "Una configuración Graph compartida para conectar Facebook Pages e Instagram Profiles.",
    authMode: "oauth",
    enabled: true,
    readiness: "ready",
    capabilities: [
      {
        id: "facebook-page",
        label: "Facebook Page",
        description: "Lectura y publicación en páginas administradas.",
        callbackUrl:
          "https://admin.zapi.test/integrations/meta/facebook-page/callback",
      },
      {
        id: "instagram-profile",
        label: "Instagram Profile",
        description: "Conexión de perfiles Business y Creator.",
        callbackUrl:
          "https://admin.zapi.test/integrations/meta/instagram-profile/callback",
      },
    ],
    fields: [
      {
        id: "appId",
        label: "App ID",
        value: "812304567890123",
        required: true,
      },
      {
        id: "appSecret",
        label: "App Secret",
        value: "",
        type: "password",
        required: true,
        hasStoredSecret: true,
        helper: "Guardado como valor enmascarado.",
      },
      {
        id: "graphVersion",
        label: "Graph API version",
        value: "v25.0",
        required: true,
      },
      {
        id: "scopes",
        label: "Scopes",
        value:
          "public_profile, pages_read_engagement, pages_manage_posts, pages_show_list, business_management, instagram_basic, instagram_content_publish",
        required: true,
      },
    ],
    checklist: [
      { id: "app", label: "App ID y App Secret configurados", complete: true },
      { id: "version", label: "Graph API version fijada", complete: true },
      {
        id: "callbacks",
        label: "Callbacks OAuth registrados por capability",
        complete: true,
      },
      {
        id: "deletion",
        label: "Callback de eliminación de datos registrado",
        complete: true,
      },
    ],
    dataDeletionCallbackUrl:
      "https://admin.zapi.test/integrations/meta/data-deletion",
  },
  {
    id: "linkedin-profile",
    label: "LinkedIn Profile",
    description: "OAuth para perfiles de miembros y publicación en feed.",
    authMode: "oauth",
    enabled: true,
    readiness: "incomplete",
    capabilities: [
      {
        id: "linkedin-profile",
        label: "Profile",
        description: "Autorización de miembros de LinkedIn.",
        callbackUrl:
          "https://admin.zapi.test/integrations/linkedin/profile/callback",
      },
    ],
    fields: [
      {
        id: "appId",
        label: "Client ID",
        value: "linkedin-demo-client",
        required: true,
      },
      {
        id: "appSecret",
        label: "Client Secret",
        value: "",
        type: "password",
        required: true,
        helper: "Añade el secret emitido para esta app.",
      },
      {
        id: "scopes",
        label: "Scopes",
        value: "openid profile email w_member_social",
        required: true,
      },
    ],
    checklist: [
      { id: "app", label: "Client ID configurado", complete: true },
      { id: "secret", label: "Client Secret configurado", complete: false },
      { id: "callback", label: "Callback OAuth registrado", complete: true },
    ],
  },
  {
    id: "linkedin-page",
    label: "LinkedIn Page",
    description: "OAuth dedicado para páginas de organización.",
    authMode: "oauth",
    enabled: true,
    readiness: "ready",
    capabilities: [
      {
        id: "linkedin-page",
        label: "Page",
        description: "Publicación para organizaciones autorizadas.",
        callbackUrl:
          "https://admin.zapi.test/integrations/linkedin/page/callback",
      },
    ],
    fields: [
      {
        id: "appId",
        label: "Client ID",
        value: "linkedin-pages-demo",
        required: true,
      },
      {
        id: "appSecret",
        label: "Client Secret",
        value: "",
        type: "password",
        required: true,
        hasStoredSecret: true,
        helper: "Guardado como valor enmascarado.",
      },
      {
        id: "scopes",
        label: "Scopes",
        value:
          "w_organization_social r_organization_social rw_organization_admin",
        required: true,
      },
    ],
    checklist: [
      {
        id: "credentials",
        label: "Credenciales OAuth configuradas",
        complete: true,
      },
      { id: "callback", label: "Callback OAuth registrado", complete: true },
      {
        id: "scopes",
        label: "Scopes de organización revisados",
        complete: true,
      },
    ],
  },
  {
    id: "x",
    label: "X",
    description: "OAuth para perfiles y publicación de posts en X.",
    authMode: "oauth",
    enabled: false,
    readiness: "disabled",
    capabilities: [
      {
        id: "x-profile",
        label: "Profile",
        description: "Conexión de perfiles y publicación de posts.",
        callbackUrl: "https://admin.zapi.test/integrations/x/profile/callback",
      },
    ],
    fields: [
      {
        id: "clientId",
        label: "Client ID",
        value: "x-demo-client-id",
        required: true,
      },
      {
        id: "clientSecret",
        label: "Client Secret",
        value: "",
        type: "password",
        required: true,
        hasStoredSecret: true,
        helper: "Guardado como valor enmascarado.",
      },
      {
        id: "scopes",
        label: "Scopes",
        value: "tweet.read tweet.write users.read offline.access media.write",
        required: true,
      },
    ],
    checklist: [
      {
        id: "credentials",
        label: "Credenciales OAuth configuradas",
        complete: true,
      },
      { id: "callback", label: "Callback OAuth registrado", complete: true },
      {
        id: "enabled",
        label: "Provider habilitado para workspaces",
        complete: false,
      },
    ],
  },
  {
    id: "tiktok",
    label: "TikTok",
    description: "OAuth para perfiles y capacidades de vídeo.",
    authMode: "oauth",
    enabled: true,
    readiness: "ready",
    capabilities: [
      {
        id: "tiktok-profile",
        label: "Profile",
        description: "Conexión de perfil y acceso a vídeo.",
        callbackUrl:
          "https://admin.zapi.test/integrations/tiktok/profile/callback",
      },
    ],
    fields: [
      {
        id: "clientKey",
        label: "Client Key",
        value: "tiktok-demo-client-key",
        required: true,
      },
      {
        id: "clientSecret",
        label: "Client Secret",
        value: "",
        type: "password",
        required: true,
        hasStoredSecret: true,
        helper: "Guardado como valor enmascarado.",
      },
      {
        id: "scopes",
        label: "Scopes",
        value:
          "user.info.basic,user.info.profile,user.info.stats,video.list,video.publish,video.upload",
        required: true,
      },
    ],
    checklist: [
      {
        id: "credentials",
        label: "Client Key y Client Secret configurados",
        complete: true,
      },
      { id: "callback", label: "Callback OAuth registrado", complete: true },
      { id: "scopes", label: "Scopes de vídeo revisados", complete: true },
    ],
  },
  {
    id: "whatsapp-status",
    label: "WhatsApp Status · GOWA",
    description:
      "Conector manual para publicar una imagen o vídeo en WhatsApp Status.",
    authMode: "basic",
    enabled: true,
    readiness: "ready",
    capabilities: [
      {
        id: "whatsapp-status",
        label: "Status",
        description: "Publicación a través del conector GOWA.",
      },
    ],
    fields: [
      {
        id: "baseUrl",
        label: "GOWA Base URL",
        value: "https://gowa-sandbox.zapi.test",
        type: "url",
        required: true,
        helper: "URL base del conector, sin barra final.",
      },
      {
        id: "basicAuthUsername",
        label: "Basic Auth username",
        value: "gowa-demo",
        required: true,
      },
      {
        id: "basicAuthPassword",
        label: "Basic Auth password",
        value: "",
        type: "password",
        required: true,
        hasStoredSecret: true,
        helper: "Guardado como valor enmascarado.",
      },
    ],
    checklist: [
      { id: "base-url", label: "GOWA Base URL configurada", complete: true },
      { id: "auth", label: "Basic Auth configurado", complete: true },
      { id: "oauth", label: "No requiere OAuth ni callback", complete: true },
    ],
  },
]
