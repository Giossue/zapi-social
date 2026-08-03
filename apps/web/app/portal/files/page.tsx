import { FilesLibraryPage } from "@/features/files/components/files-library-page"
import { getFileLibraryMock } from "@/features/files/mocks/files-repository"

export default async function FilesRoutePage() {
  const library = await getFileLibraryMock()

  return <FilesLibraryPage library={library} />
}
