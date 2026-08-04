import { PublishingPageLoader } from "@/features/publishing/components/publishing-page-loader"

export default async function PublishingQueueRoutePage() {
  return <PublishingPageLoader initialSection="queue" />
}
