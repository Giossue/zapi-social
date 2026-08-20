export type FileAssetKind = "image" | "video" | "document"

export type FileAsset = {
  id: string
  name: string
  kind: FileAssetKind
  mimeType?: string
  folderId: string | null
  size: string
  dimensions: string | null
  updatedAt: string
  owner: string
  shared: boolean
  generatedWithAi: boolean
  starred?: boolean
  thumbnailStatus?: "pending" | "ready" | "failed" | "not_applicable"
}

export type FileFolder = {
  id: string
  parentFolderId: string | null
  name: string
  fileCount: number
  size: string
  updatedAt: string
}

export type FileLibraryData = {
  canView: boolean
  canUpload: boolean
  folderPath: readonly { id: string; name: string }[]
  folders: readonly FileFolder[]
  assets: readonly FileAsset[]
  page: number
  filesTotal: number
}
