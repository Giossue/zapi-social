import type { IntegrationProvider } from "../types/integrations"

/** Datos locales y deterministas para la Fase A; no representan credenciales reales. */
export const providerIntegrations: IntegrationProvider[] = [
  {
    id: "meta",
    label: "Meta",
    description:
      "Una configuración compartida de Graph para conectar páginas de Facebook y perfiles de Instagram.",
    authMode: "oauth",
    enabled: true,
    readiness: "ready",
    testState: "passed",
    capabilities: [
      {
        id: "facebook-page",
        label: "Página de Facebook",
        description: "Lectura y publicación en páginas administradas.",
        enabled: true,
        callbackUrl:
          "https://admin.zapi.test/integrations/meta/facebook-page/callback",
      },
      {
        id: "instagram-profile",
        label: "Perfil de Instagram",
        description: "Conexión de perfiles Business y Creator.",
        enabled: true,
        callbackUrl:
          "https://admin.zapi.test/integrations/meta/instagram-profile/callback",
      },
    ],
    fields: [
      {
        id: "appId",
        label: "ID de la aplicación",
        value: "812304567890123",
        required: true,
      },
      {
        id: "appSecret",
        label: "Secreto de la aplicación",
        value: "",
        type: "password",
        required: true,
        hasStoredSecret: true,
      },
      {
        id: "graphVersion",
        label: "Versión de Graph API",
        value: "v25.0",
        required: true,
      },
      {
        id: "scopes",
        label: "Permisos",
        value:
          "public_profile, pages_read_engagement, pages_manage_posts, pages_show_list, business_management, instagram_basic, instagram_content_publish",
        type: "multiselect",
        required: true,
      },
    ],
    checklist: [
      {
        id: "app",
        label: "ID y secreto de la aplicación configurados",
        complete: true,
      },
      {
        id: "version",
        label: "Versión de Graph API establecida",
        complete: true,
      },
      {
        id: "callbacks",
        label: "URLs de retorno OAuth registradas por tipo de canal",
        complete: true,
      },
      {
        id: "deletion",
        label: "URL de eliminación de datos registrada",
        complete: true,
      },
    ],
    dataDeletionCallbackUrl:
      "https://admin.zapi.test/integrations/meta/data-deletion",
  },
  {
    id: "linkedin-profile",
    label: "Perfil de LinkedIn",
    description: "OAuth para perfiles de miembros y publicaciones en el feed.",
    authMode: "oauth",
    enabled: true,
    readiness: "incomplete",
    testState: "not-tested",
    capabilities: [
      {
        id: "linkedin-profile",
        label: "Perfil",
        description: "Autorización de miembros de LinkedIn.",
        enabled: true,
        callbackUrl:
          "https://admin.zapi.test/integrations/linkedin/profile/callback",
      },
    ],
    fields: [
      {
        id: "appId",
        label: "ID de cliente",
        value: "linkedin-demo-client",
        required: true,
      },
      {
        id: "appSecret",
        label: "Secreto de cliente",
        value: "",
        type: "password",
        required: true,
      },
      {
        id: "scopes",
        label: "Permisos",
        value: "openid profile email w_member_social",
        type: "multiselect",
        required: true,
      },
    ],
    checklist: [
      { id: "app", label: "ID de cliente configurado", complete: true },
      {
        id: "secret",
        label: "Secreto de cliente configurado",
        complete: false,
      },
      {
        id: "callback",
        label: "URL de retorno OAuth registrada",
        complete: true,
      },
    ],
  },
  {
    id: "linkedin-page",
    label: "Página de LinkedIn",
    description: "OAuth específico para páginas de organizaciones.",
    authMode: "oauth",
    enabled: true,
    readiness: "ready",
    testState: "passed",
    capabilities: [
      {
        id: "linkedin-page",
        label: "Página",
        description: "Publicación para organizaciones autorizadas.",
        enabled: true,
        callbackUrl:
          "https://admin.zapi.test/integrations/linkedin/page/callback",
      },
    ],
    fields: [
      {
        id: "appId",
        label: "ID de cliente",
        value: "linkedin-pages-demo",
        required: true,
      },
      {
        id: "appSecret",
        label: "Secreto de cliente",
        value: "",
        type: "password",
        required: true,
        hasStoredSecret: true,
      },
      {
        id: "scopes",
        label: "Permisos",
        value:
          "w_organization_social r_organization_social rw_organization_admin",
        type: "multiselect",
        required: true,
      },
    ],
    checklist: [
      {
        id: "credentials",
        label: "Credenciales OAuth configuradas",
        complete: true,
      },
      {
        id: "callback",
        label: "URL de retorno OAuth registrada",
        complete: true,
      },
      {
        id: "scopes",
        label: "Permisos de organización revisados",
        complete: true,
      },
    ],
  },
  {
    id: "x",
    label: "X",
    description: "OAuth para perfiles y publicación en X.",
    authMode: "oauth",
    enabled: false,
    readiness: "disabled",
    testState: "not-tested",
    capabilities: [
      {
        id: "x-profile",
        label: "Perfil",
        description: "Conexión de perfiles y publicación.",
        enabled: true,
        callbackUrl: "https://admin.zapi.test/integrations/x/profile/callback",
      },
    ],
    fields: [
      {
        id: "clientId",
        label: "ID de cliente",
        value: "x-demo-client-id",
        required: true,
      },
      {
        id: "clientSecret",
        label: "Secreto de cliente",
        value: "",
        type: "password",
        required: true,
        hasStoredSecret: true,
      },
      {
        id: "scopes",
        label: "Permisos",
        value: "tweet.read tweet.write users.read offline.access media.write",
        type: "multiselect",
        required: true,
      },
    ],
    checklist: [
      {
        id: "credentials",
        label: "Credenciales OAuth configuradas",
        complete: true,
      },
      {
        id: "callback",
        label: "URL de retorno OAuth registrada",
        complete: true,
      },
      {
        id: "enabled",
        label: "Proveedor habilitado para espacios de trabajo",
        complete: false,
      },
    ],
  },
  {
    id: "tiktok",
    label: "TikTok",
    description: "OAuth para perfiles y funciones de vídeo.",
    authMode: "oauth",
    enabled: true,
    readiness: "ready",
    testState: "passed",
    capabilities: [
      {
        id: "tiktok-profile",
        label: "Perfil",
        description: "Conexión de perfil y acceso a vídeos.",
        enabled: true,
        callbackUrl:
          "https://admin.zapi.test/integrations/tiktok/profile/callback",
      },
    ],
    fields: [
      {
        id: "clientKey",
        label: "Clave de cliente",
        value: "tiktok-demo-client-key",
        required: true,
      },
      {
        id: "clientSecret",
        label: "Secreto de cliente",
        value: "",
        type: "password",
        required: true,
        hasStoredSecret: true,
      },
      {
        id: "scopes",
        label: "Permisos",
        value:
          "user.info.basic,user.info.profile,user.info.stats,video.list,video.publish,video.upload",
        type: "multiselect",
        required: true,
      },
    ],
    checklist: [
      {
        id: "credentials",
        label: "Clave y secreto de cliente configurados",
        complete: true,
      },
      {
        id: "callback",
        label: "URL de retorno OAuth registrada",
        complete: true,
      },
      { id: "scopes", label: "Permisos de vídeo revisados", complete: true },
    ],
  },
  {
    id: "whatsapp-status",
    label: "Historias de WhatsApp",
    description:
      "Conector manual para publicar una imagen o vídeo en Historias de WhatsApp.",
    authMode: "basic",
    enabled: true,
    readiness: "ready",
    testState: "passed",
    capabilities: [
      {
        id: "whatsapp-status",
        label: "Historias de WhatsApp",
        description: "Publicación mediante el conector.",
        enabled: true,
      },
    ],
    fields: [
      {
        id: "baseUrl",
        label: "URL del conector",
        value: "https://conector-sandbox.zapi.test",
        type: "url",
        required: true,
        placeholder: "https://conector.ejemplo.com",
      },
      {
        id: "basicAuthUsername",
        label: "Usuario del conector",
        value: "conector-demo",
        required: true,
      },
      {
        id: "basicAuthPassword",
        label: "Contraseña del conector",
        value: "",
        type: "password",
        required: true,
        hasStoredSecret: true,
      },
    ],
    checklist: [
      { id: "base-url", label: "URL del conector configurada", complete: true },
      { id: "auth", label: "Conector configurado", complete: true },
      {
        id: "oauth",
        label: "No requiere OAuth ni URL de retorno",
        complete: true,
      },
    ],
  },
]
