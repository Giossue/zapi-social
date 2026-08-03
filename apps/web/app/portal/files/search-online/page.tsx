import { OnlineMediaSearchPage } from "@/features/files/components/online-media-search-page"
import { getOnlineMediaSearchMock } from "@/features/files/mocks/files-repository"

export default async function OnlineMediaSearchRoutePage() {
  const search = await getOnlineMediaSearchMock()

  return <OnlineMediaSearchPage search={search} />
}
