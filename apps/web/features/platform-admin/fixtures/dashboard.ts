import type { AdminDashboard } from "../types/dashboard"

export const adminDashboardFixture: AdminDashboard = {
  metrics: [
    { label: "Proveedores activos", value: "3", description: "Configuraciones habilitadas" },
    { label: "Integraciones pendientes", value: "2", description: "Requieren completar credenciales" },
    { label: "Estado de plataforma", value: "Estable", description: "Sin incidencias abiertas" },
  ],
  activity: [
    { title: "Revisar proveedores incompletos", description: "Dos configuraciones no están listas para los workspaces.", status: "attention" },
    { title: "Conectividad de proveedores", description: "Las integraciones activas reportan disponibilidad normal.", status: "healthy" },
  ],
}
