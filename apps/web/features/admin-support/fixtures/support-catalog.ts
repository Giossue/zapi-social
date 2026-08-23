import type { AdminSupportUserFixture } from "../components/admin-support-new-case-sheet"
import type { SupportCatalogItem } from "../components/support-catalog-panel"

/**
 * Fixtures deterministas del mock de creación y catálogos. Equivalen a los
 * hijos Laravel `New Ticket`, `Manage Labels` y `Manage Types`; las mutaciones
 * reales llegan con la vertical de soporte.
 */
export const fixtureUsers: readonly AdminSupportUserFixture[] = [
  {
    id: "user-1",
    name: "María Andrade",
    email: "maria@auroracreativa.com",
    workspaceName: "Aurora Studio",
  },
  {
    id: "user-2",
    name: "Daniel Vera",
    email: "daniel@northlab.io",
    workspaceName: "North Lab",
  },
  {
    id: "user-3",
    name: "Sofía Torres",
    email: "sofia@demo.zapi.social",
    workspaceName: "Demo Workspace",
  },
  {
    id: "user-4",
    name: "Lucía Herrera",
    email: "lucia@brandpulse.co",
    workspaceName: "Brand Pulse",
  },
]

export const initialLabels: readonly SupportCatalogItem[] = [
  { id: "label-1", name: "Urgente", isActive: true },
  { id: "label-2", name: "Facturación", isActive: true },
  { id: "label-3", name: "Error de producto", isActive: true },
  { id: "label-4", name: "Seguimiento", isActive: false },
]

export const initialTypes: readonly SupportCatalogItem[] = [
  { id: "type-1", name: "Incidencia", isActive: true },
  { id: "type-2", name: "Solicitud", isActive: true },
  { id: "type-3", name: "Pregunta", isActive: true },
  { id: "type-4", name: "Mejora", isActive: false },
]
