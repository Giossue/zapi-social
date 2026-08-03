"use client"

import { FilesErrorState } from "@/features/files/components/files-states"

type FilesErrorRouteProps = {
  reset: () => void
}

export default function FilesErrorRoute({ reset }: FilesErrorRouteProps) {
  return <FilesErrorState onRetry={reset} section="biblioteca" />
}
