import { redirect } from "next/navigation"

type LegacyChannelsRoutePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ChannelsRoutePage({
  searchParams,
}: LegacyChannelsRoutePageProps) {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.set(key, value)
    else value?.forEach((entry) => query.append(key, entry))
  }

  redirect(
    `/portal/settings/channels${query.size ? `?${query.toString()}` : ""}`
  )
}
