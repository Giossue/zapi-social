import { PublishingPageLoader } from "@/features/publishing/components/publishing-page-loader"

export default async function PublishingDraftsRoutePage() {
  return <PublishingPageLoader initialSection="drafts" />
}
