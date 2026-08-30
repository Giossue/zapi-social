import { redirect } from "next/navigation"

export type LegacySettingsSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

export async function redirectToPortalSettings(
  destination: string,
  searchParams: LegacySettingsSearchParams,
  overrides: Readonly<Record<string, string>> = {}
) {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.set(key, value)
    else value?.forEach((entry) => query.append(key, entry))
  }

  for (const [key, value] of Object.entries(overrides)) {
    query.set(key, value)
  }

  redirect(`${destination}${query.size ? `?${query.toString()}` : ""}`)
}
