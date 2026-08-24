import type {
  SupportCategory,
  SupportTicketDetail,
} from "@/features/support/types/support"

export const supportCategoriesFixture: SupportCategory[] = [
  {
    id: "1ea2c1b7-3e1e-4cd1-9e8f-3d5c4b81d3d1",
    name: "Cuenta y acceso",
    slug: "account-access",
    description: "Inicio de sesión, miembros y permisos del espacio.",
  },
  {
    id: "a6aef520-2c23-4435-9b42-6c3b7c0e25e2",
    name: "Publicación y canales",
    slug: "publishing-channels",
    description: "Publicaciones, programaciones y cuentas conectadas.",
  },
  {
    id: "f89e89ab-957d-48b0-a1cd-1a9c6a0bc133",
    name: "Facturación y plan",
    slug: "billing-plan",
    description: "Plan, facturas y límites del espacio de trabajo.",
  },
  {
    id: "bdf99701-1d68-4732-bdec-4e74073b5c24",
    name: "Otro problema",
    slug: "other",
    description: "Cuéntanos qué necesitas y lo derivaremos al equipo indicado.",
  },
]

const account = supportCategoriesFixture[0]!
const publishing = supportCategoriesFixture[1]!
const billing = supportCategoriesFixture[2]!

export const supportTicketsFixture: SupportTicketDetail[] = [
  {
    id: "5e51546c-fcd4-4bc8-a208-ae74c13a8b56",
    category: publishing,
    subject: "La imagen no se muestra en la vista previa",
    description:
      "Al preparar una publicación para Instagram, el archivo adjunto aparece vacío aunque sí está disponible en la biblioteca.",
    status: "open",
    commentCount: 2,
    createdAt: "2026-08-02T14:20:00.000Z",
    updatedAt: "2026-08-04T16:10:00.000Z",
    resolvedAt: null,
    comments: [
      {
        id: "c963d70f-817c-457e-b0d7-3b50df0b1001",
        authorName: "Zapi test chang",
        authorRole: "requester",
        body: "La publicación queda en borrador, pero la vista previa sale sin la imagen.",
        createdAt: "2026-08-02T14:20:00.000Z",
      },
      {
        id: "d0630b54-dc99-408c-8cbf-0ec607f2760c",
        authorName: "Equipo Zapi",
        authorRole: "support",
        body: "Estamos revisando el archivo y la conexión con el canal. Te avisaremos por este caso.",
        createdAt: "2026-08-04T16:10:00.000Z",
      },
    ],
  },
  {
    id: "b583e4cc-b1af-4766-a6c1-3637a23e598e",
    category: account,
    subject: "Necesito actualizar el rol de una persona del equipo",
    description:
      "Quiero que una integrante pueda administrar los canales del espacio sin acceder a la facturación.",
    status: "resolved",
    commentCount: 1,
    createdAt: "2026-07-28T09:35:00.000Z",
    updatedAt: "2026-07-29T11:05:00.000Z",
    resolvedAt: "2026-07-29T11:05:00.000Z",
    comments: [
      {
        id: "a4cdf283-f6c6-489e-81c4-4ace86de4b16",
        authorName: "Equipo Zapi",
        authorRole: "support",
        body: "Ya puedes hacerlo desde Equipo: edita a la persona y asigna el rol de gestor de canales.",
        createdAt: "2026-07-29T11:05:00.000Z",
      },
    ],
  },
  {
    id: "0f8c7b75-92cc-44e2-9c8e-4d861d296531",
    category: billing,
    subject: "Consulta sobre el límite de publicaciones del plan",
    description:
      "Quisiera confirmar si las publicaciones que quedan como borrador consumen el límite mensual.",
    status: "closed",
    commentCount: 1,
    createdAt: "2026-07-11T18:02:00.000Z",
    updatedAt: "2026-07-12T10:45:00.000Z",
    resolvedAt: "2026-07-12T10:45:00.000Z",
    comments: [
      {
        id: "892ab932-b7df-4328-b651-75a34cbc2108",
        authorName: "Equipo Zapi",
        authorRole: "support",
        body: "No. Solo cuentan las publicaciones que se envían a un canal; los borradores no consumen ese límite.",
        createdAt: "2026-07-12T10:45:00.000Z",
      },
    ],
  },
]
