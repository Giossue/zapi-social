import type { AdminPlan, PlanPermissionGroup } from "../types/plans"

export const planPermissionGroups: readonly PlanPermissionGroup[] = [
  {
    id: "workspace",
    label: "Espacio de trabajo",
    permissions: [
      {
        id: "workspace.view",
        label: "Ver espacio",
        description: "Acceder a la configuración general.",
      },
      {
        id: "workspace.members",
        label: "Gestionar miembros",
        description: "Invitar y administrar colaboradores.",
      },
      {
        id: "workspace.brand",
        label: "Gestionar marca",
        description: "Actualizar identidad y preferencias.",
      },
    ],
  },
  {
    id: "publishing",
    label: "Publicación",
    permissions: [
      {
        id: "publishing.create",
        label: "Crear publicaciones",
        description: "Preparar borradores y contenidos.",
      },
      {
        id: "publishing.schedule",
        label: "Programar publicaciones",
        description: "Definir una fecha de salida.",
      },
      {
        id: "publishing.approve",
        label: "Aprobar publicaciones",
        description: "Revisar y publicar contenidos.",
      },
      {
        id: "rss_schedules.view",
        label: "Ver programaciones RSS",
        description: "Consultar los feeds y su actividad de publicación.",
      },
      {
        id: "rss_schedules.manage",
        label: "Gestionar programaciones RSS",
        description: "Crear, editar, ejecutar y eliminar automatizaciones RSS.",
      },
    ],
  },
  {
    id: "reporting",
    label: "Reportes",
    permissions: [
      {
        id: "reporting.view",
        label: "Ver reportes",
        description: "Consultar el rendimiento publicado.",
      },
      {
        id: "reporting.export",
        label: "Exportar reportes",
        description: "Descargar informes disponibles.",
      },
    ],
  },
]

export const adminPlansFixture: readonly AdminPlan[] = [
  {
    id: "plan-free",
    name: "Gratis",
    slug: "gratis",
    status: "active",
    featured: false,
    currency: "USD",
    price: 0,
    billingType: "monthly",
    isFree: true,
    isDefaultSignup: true,
    trialDays: 0,
    position: 1,
    description:
      "Un punto de partida sencillo para equipos que están conociendo Zapi.",
    subscriberCount: 1842,
    permissionIds: ["workspace.view", "publishing.create", "reporting.view"],
  },
  {
    id: "plan-pro",
    name: "Profesional",
    slug: "profesional",
    status: "active",
    featured: true,
    currency: "USD",
    price: 29,
    billingType: "monthly",
    isFree: false,
    isDefaultSignup: false,
    trialDays: 14,
    position: 2,
    description:
      "La propuesta principal para equipos que publican con un flujo coordinado.",
    subscriberCount: 624,
    permissionIds: [
      "workspace.view",
      "workspace.members",
      "publishing.create",
      "publishing.schedule",
      "rss_schedules.view",
      "rss_schedules.manage",
      "reporting.view",
    ],
  },
  {
    id: "plan-business",
    name: "Business",
    slug: "business",
    status: "active",
    featured: true,
    currency: "USD",
    price: 79,
    billingType: "monthly",
    isFree: false,
    isDefaultSignup: false,
    trialDays: 14,
    position: 3,
    description:
      "Para operaciones que requieren revisión, gobierno y reportes compartidos.",
    subscriberCount: 147,
    permissionIds: [
      "workspace.view",
      "workspace.members",
      "workspace.brand",
      "publishing.create",
      "publishing.schedule",
      "publishing.approve",
      "rss_schedules.view",
      "rss_schedules.manage",
      "reporting.view",
      "reporting.export",
    ],
  },
  {
    id: "plan-annual",
    name: "Profesional anual",
    slug: "profesional-anual",
    status: "inactive",
    featured: false,
    currency: "USD",
    price: 290,
    billingType: "yearly",
    isFree: false,
    isDefaultSignup: false,
    trialDays: 0,
    position: 4,
    description:
      "Oferta anual archivada, mantenida para las suscripciones existentes.",
    subscriberCount: 93,
    permissionIds: [
      "workspace.view",
      "workspace.members",
      "publishing.create",
      "publishing.schedule",
      "rss_schedules.view",
      "rss_schedules.manage",
      "reporting.view",
    ],
  },
]
