import { expect, test, type Page } from "@playwright/test"

type Credentials = {
  email: string
  password: string
}

function credentials(prefix: "ADMIN" | "PORTAL"): Credentials {
  const email = process.env[`E2E_${prefix}_EMAIL`]?.trim()
  const password = process.env[`E2E_${prefix}_PASSWORD`]
  if (!email || !password) {
    throw new Error(`MISSING:E2E_${prefix}_EMAIL,E2E_${prefix}_PASSWORD`)
  }
  return { email, password }
}

async function login(
  page: Page,
  area: "admin" | "portal",
  account: Credentials
) {
  const sessionResponse = await page.request.post("/api/v1/auth/login", {
    data: { ...account, remember: false },
  })
  expect(sessionResponse.ok()).toBe(true)
  const authenticated = (await sessionResponse.json()) as { area?: string }
  expect(authenticated.area).toBe(area)
  const cookieNames = (await page.context().cookies()).map(
    (cookie) => cookie.name
  )
  expect(cookieNames).toContain("zapi_access")
  expect(cookieNames).toContain("zapi_session")
  const session = await page.request.get("/api/v1/auth/session")
  expect(session.ok()).toBe(true)
}

test("protege rutas privadas y bloquea setup completado", async ({ page }) => {
  await page.goto("/portal/plans")
  await expect(page).toHaveURL(/\/login\?next=%2Fportal%2Fplans$/)

  await page.goto("/setup")
  await expect(page).toHaveURL(/\/login$/)
})

test.describe("administración", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin", credentials("ADMIN"))
  })

  test("abre superficies críticas sin errores de servidor", async ({
    page,
  }) => {
    for (const path of [
      "/admin/dashboard",
      "/admin/notifications",
      "/admin/plans",
    ]) {
      const response = await page.goto(path)
      expect(response?.status()).toBeLessThan(400)
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.locator("main")).toBeVisible()
    }
    await expect(
      page.getByRole("heading", { name: "Planes", exact: true })
    ).toBeVisible()
  })

  test("mantiene las acciones del sheet visibles al desplazar", async ({
    page,
  }) => {
    await page.goto("/admin/plans")
    await page.getByRole("button", { name: "Crear plan" }).first().click()

    const sheet = page.locator('[data-slot="sheet-content"]')
    const viewport = sheet.locator('[data-slot="scroll-area-viewport"]')
    const actions = sheet.locator('[data-slot="sheet-footer"]')
    await expect(sheet).toBeVisible()
    await expect(actions).toBeVisible()

    const initialBox = await actions.boundingBox()
    expect(initialBox).not.toBeNull()
    expect(initialBox!.y + initialBox!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height
    )

    await viewport.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect(viewport).toHaveJSProperty(
      "scrollTop",
      await viewport.evaluate((element) => element.scrollTop)
    )

    const scrolledBox = await actions.boundingBox()
    expect(scrolledBox).not.toBeNull()
    expect(scrolledBox!.y + scrolledBox!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height
    )
    expect(Math.abs(scrolledBox!.y - initialBox!.y)).toBeLessThan(2)
    await expect(
      actions.getByRole("button", { name: "Cancelar" })
    ).toBeVisible()
  })
})

test.describe("portal", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "portal", credentials("PORTAL"))
  })

  test("abre dashboard, notificaciones y planes", async ({ page }) => {
    for (const path of [
      "/portal/dashboard",
      "/portal/notifications",
      "/portal/plans",
    ]) {
      const response = await page.goto(path)
      expect(response?.status()).toBeLessThan(400)
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.locator("main")).toBeVisible()
    }
    await expect(
      page.getByRole("heading", { name: "Planes y facturación" })
    ).toBeVisible()
  })

  test("muestra los filtros del historial de notificaciones", async ({
    page,
  }) => {
    await page.goto("/portal/notifications")
    const tabs = page.getByRole("tablist", { name: "Notificaciones" })
    await expect(tabs).toBeVisible()
    for (const name of ["Todas", "No leídas", "Leídas", "Archivadas"]) {
      await expect(tabs.getByRole("tab", { name, exact: true })).toBeVisible()
    }
  })

  test("aplica el tema oscuro", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "dark"))
    await page.goto("/portal/dashboard")
    await expect(page.locator("html")).toHaveClass(/dark/)
  })
})
