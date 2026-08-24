export const MAX_FILE_BYTES = 100 * 1024 * 1024

export const fileMimeTypes: Record<string, readonly string[]> = {
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  gif: ["image/gif"],
  avif: ["image/avif"],
  mp4: ["video/mp4"],
  webm: ["video/webm"],
  mov: ["video/quicktime"],
  mp3: ["audio/mpeg"],
  wav: ["audio/wav", "audio/x-wav"],
  m4a: ["audio/mp4"],
  ogg: ["audio/ogg"],
  pdf: ["application/pdf"],
  txt: ["text/plain"],
  md: ["text/markdown", "text/plain"],
  json: ["application/json"],
  csv: ["text/csv"],
  rtf: ["application/rtf", "text/rtf"],
  zip: ["application/zip", "application/x-zip-compressed"],
  "7z": ["application/x-7z-compressed"],
  rar: ["application/vnd.rar", "application/x-rar-compressed"],
  tar: ["application/x-tar"],
  gz: ["application/gzip", "application/x-gzip"],
  doc: ["application/msword"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  odt: ["application/vnd.oasis.opendocument.text"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ods: ["application/vnd.oasis.opendocument.spreadsheet"],
}

export function allowedMime(extension: string, mime: string) {
  const allowed = fileMimeTypes[extension.toLowerCase()]
  if (!allowed) return null
  const normalized = mime.toLowerCase()
  return allowed.includes(normalized)
    ? normalized
    : normalized === "application/octet-stream"
      ? (allowed[0] ?? null)
      : null
}

export function matchesFileSignature(
  extension: string,
  expected: string,
  detected: string
) {
  if (["txt", "md", "csv"].includes(extension)) return detected === "text/plain"
  if (extension === "json") return detected === "application/json"
  if (extension === "rtf") return detected === "application/rtf"
  if (["docx", "xlsx", "odt", "ods"].includes(extension))
    return detected === "application/zip"
  if (["doc", "xls"].includes(extension))
    return detected === "application/x-ole-storage"
  return (
    detected === expected ||
    (extension === "wav" && detected === "audio/wav") ||
    (extension === "gz" && detected === "application/gzip")
  )
}

export function detectFileMime(buffer: Buffer) {
  const starts = (value: number[]) =>
    buffer.subarray(0, value.length).equals(Buffer.from(value))
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg"
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png"
  if (
    buffer.subarray(0, 6).toString("ascii") === "GIF87a" ||
    buffer.subarray(0, 6).toString("ascii") === "GIF89a"
  )
    return "image/gif"
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp"
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WAVE"
  )
    return "audio/wav"
  if (buffer.subarray(0, 4).toString("ascii") === "%PDF")
    return "application/pdf"
  if (starts([0x50, 0x4b, 0x03, 0x04]) || starts([0x50, 0x4b, 0x05, 0x06]))
    return "application/zip"
  if (starts([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))
    return "application/x-7z-compressed"
  if (
    buffer.subarray(0, 7).toString("ascii") === "Rar!\x1a\x07\x00" ||
    buffer.subarray(0, 8).toString("ascii") === "Rar!\x1a\x07\x01\x00"
  )
    return "application/vnd.rar"
  if (starts([0x1f, 0x8b])) return "application/gzip"
  if (buffer.subarray(257, 262).toString("ascii") === "ustar")
    return "application/x-tar"
  if (starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    return "application/x-ole-storage"
  if (buffer.subarray(0, 4).toString("ascii") === "OggS") return "audio/ogg"
  if (starts([0x1a, 0x45, 0xdf, 0xa3])) return "video/webm"
  if (
    buffer.subarray(0, 3).toString("ascii") === "ID3" ||
    (buffer[0] === 0xff && (buffer[1] ?? 0) >= 0xe0)
  )
    return "audio/mpeg"
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii")
    if (brand === "qt  ") return "video/quicktime"
    if (brand === "M4A ") return "audio/mp4"
    if (brand === "avif" || brand === "avis") return "image/avif"
    return "video/mp4"
  }
  const text = buffer.toString("utf8")
  if (!buffer.includes(0) && text.trim()) {
    if (text.trimStart().startsWith("{\\rtf")) return "application/rtf"
    try {
      JSON.parse(text)
      return "application/json"
    } catch {
      return "text/plain"
    }
  }
  return null
}

export function fileKind(mime: string) {
  if (mime.startsWith("image/")) return "image" as const
  if (mime.startsWith("video/")) return "video" as const
  if (mime === "application/pdf") return "pdf" as const
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime.includes("opendocument.spreadsheet")
  )
    return "spreadsheet" as const
  if (
    mime.includes("zip") ||
    mime.includes("archive") ||
    mime.includes("gzip") ||
    mime.includes("rar") ||
    mime.includes("tar")
  )
    return "archive" as const
  return "document" as const
}

export const TMP_STORAGE_PREFIX = "tmp"

function storageShard(workspaceId: string) {
  const shard = workspaceId
    .replace(/[^0-9a-z]/gi, "")
    .slice(0, 2)
    .toLowerCase()
  return shard.length === 2 ? shard : "00"
}

export function storageExtension(name: string | null | undefined) {
  const match = /\.([0-9a-z]{1,12})$/i.exec(name ?? "")
  return match ? `.${match[1]!.toLowerCase()}` : ""
}

export function workspaceStoragePrefix(workspaceId: string) {
  return `ws/${storageShard(workspaceId)}/${workspaceId}`
}

export function originalStorageKey(input: {
  workspaceId: string
  assetId: string
  extension?: string | null
  at?: Date
}) {
  const at = input.at ?? new Date()
  const year = String(at.getUTCFullYear())
  const month = String(at.getUTCMonth() + 1).padStart(2, "0")
  const extension = storageExtension(input.extension)
  return `${workspaceStoragePrefix(input.workspaceId)}/orig/${year}/${month}/${input.assetId}${extension}`
}

export function derivativeStoragePrefix(workspaceId: string, assetId: string) {
  return `${workspaceStoragePrefix(workspaceId)}/drv/${assetId}`
}

export function derivativeStorageKey(input: {
  workspaceId: string
  assetId: string
  name: string
}) {
  return `${derivativeStoragePrefix(input.workspaceId, input.assetId)}/${input.name}`
}

export function thumbnailStorageKey(workspaceId: string, assetId: string) {
  return derivativeStorageKey({ workspaceId, assetId, name: "thumb.webp" })
}

export function publishVariantStorageKey(input: {
  workspaceId: string
  assetId: string
  postId: string
  extension?: string | null
}) {
  const extension = storageExtension(input.extension)
  return derivativeStorageKey({
    workspaceId: input.workspaceId,
    assetId: input.assetId,
    name: `publish-${input.postId}${extension}`,
  })
}

export function temporaryStorageKey(uploadId: string) {
  return `${TMP_STORAGE_PREFIX}/${uploadId}`
}
