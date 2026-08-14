import type {
  GoogleDriveIntegrationConfiguration,
  GoogleDrivePickerSelection,
} from "@workspace/contracts"
import { auditApi } from "@workspace/api-client"

type GoogleTokenResponse = {
  access_token?: string
  expires_in?: number
  error?: string
}

type PickerDocument = {
  id?: string
  resourceKey?: string
}

type PickerResponse = {
  action?: string
  docs?: PickerDocument[]
}

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/drive.file"
const MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
].join(",")
const PICKER_IMPLEMENTATION = "drive-picker-element-v5"

type GoogleDrivePickerElement = HTMLElement & { visible: boolean }

let componentPromise: Promise<void> | null = null

async function loadGooglePickerComponent() {
  componentPromise ??= import("@googleworkspace/drive-picker-element").then(
    () => undefined
  )
  await componentPromise
  await customElements.whenDefined("drive-picker")
}

export type GoogleDrivePickerResult = {
  accessToken: string
  credentialExpiresAt: string
  files: GoogleDrivePickerSelection[]
}

type GoogleDrivePickerDiagnostics = {
  pagePath: string
  serverFingerprint?: string | null
  sourceContext: "files" | "publishing"
}

async function configurationFingerprint(
  configuration: GoogleDriveIntegrationConfiguration
) {
  const bytes = new TextEncoder().encode(
    `${configuration.oauthClientId}\u0000${configuration.browserApiKey}\u0000${configuration.appId}`
  )
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
}

function logPickerDiagnostics({
  configuration,
  diagnostics,
  picker,
}: {
  configuration: GoogleDriveIntegrationConfiguration
  diagnostics: GoogleDrivePickerDiagnostics
  picker: HTMLElement
}) {
  void configurationFingerprint(configuration)
    .then((clientFingerprint) =>
      auditApi.logWebEvent({
        event: "google_drive.picker_opened",
        severity: "success",
        outcome: "attempted",
        pagePath: diagnostics.pagePath,
        summary: "Portal attempted to open Google Drive Picker.",
        metadata: {
          sourceContext: diagnostics.sourceContext,
          implementation: PICKER_IMPLEMENTATION,
          origin: window.location.origin,
          clientFingerprint,
          serverFingerprint: diagnostics.serverFingerprint ?? null,
          fingerprintMatches:
            !diagnostics.serverFingerprint ||
            diagnostics.serverFingerprint === clientFingerprint,
          developerKeyAttached:
            picker.getAttribute("developer-key") ===
            configuration.browserApiKey,
          browserApiKeyLength: configuration.browserApiKey.length,
          browserApiKeyLooksValid: /^AIza[\w-]{35}$/.test(
            configuration.browserApiKey
          ),
        },
      })
    )
    .catch(() => undefined)
}

export async function openGoogleDrivePicker({
  configuration,
  diagnostics,
  multiselect,
}: {
  configuration: GoogleDriveIntegrationConfiguration
  diagnostics?: GoogleDrivePickerDiagnostics
  multiselect: boolean
}): Promise<GoogleDrivePickerResult | null> {
  await loadGooglePickerComponent()

  return new Promise<GoogleDrivePickerResult | null>((resolve, reject) => {
    const picker = document.createElement(
      "drive-picker"
    ) as GoogleDrivePickerElement
    const view = document.createElement("drive-picker-docs-view")
    let token: GoogleTokenResponse | null = null
    let settled = false

    picker.setAttribute("client-id", configuration.oauthClientId)
    picker.setAttribute("developer-key", configuration.browserApiKey)
    picker.setAttribute("app-id", configuration.appId)
    picker.setAttribute("scope", GOOGLE_SCOPE)
    picker.setAttribute("prompt", "select_account")
    picker.setAttribute("origin", window.location.origin)
    if (multiselect) picker.setAttribute("multiselect", "true")

    view.setAttribute("view-id", "DOCS")
    view.setAttribute("mime-types", MEDIA_MIME_TYPES)
    view.setAttribute("include-folders", "false")
    view.setAttribute("select-folder-enabled", "false")
    view.setAttribute("mode", "LIST")
    picker.append(view)

    if (diagnostics) {
      logPickerDiagnostics({ configuration, diagnostics, picker })
    }

    const cleanup = () => {
      picker.removeEventListener(
        "picker-oauth-response",
        handleOAuthResponse as EventListener
      )
      picker.removeEventListener(
        "picker-oauth-error",
        handleError as EventListener
      )
      picker.removeEventListener("picker-error", handleError as EventListener)
      picker.removeEventListener(
        "picker-canceled",
        handleCanceled as EventListener
      )
      picker.removeEventListener("picker-picked", handlePicked as EventListener)
      picker.remove()
    }

    const finish = (result: GoogleDrivePickerResult | null) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }

    const fail = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error("GOOGLE_PICKER_FAILED"))
    }

    function handleOAuthResponse(event: CustomEvent<GoogleTokenResponse>) {
      token = event.detail
    }

    function handleError() {
      fail()
    }

    function handleCanceled() {
      finish(null)
    }

    function handlePicked(event: CustomEvent<PickerResponse>) {
      if (!token?.access_token || !token.expires_in || token.error) {
        fail()
        return
      }
      const files = (event.detail.docs ?? []).flatMap((document) =>
        document.id
          ? [
              {
                providerFileId: document.id,
                ...(document.resourceKey
                  ? { resourceKey: document.resourceKey }
                  : {}),
              },
            ]
          : []
      )
      if (!files.length) {
        finish(null)
        return
      }
      finish({
        accessToken: token.access_token,
        credentialExpiresAt: new Date(
          Date.now() + Math.max(30, token.expires_in - 30) * 1000
        ).toISOString(),
        files,
      })
    }

    picker.addEventListener(
      "picker-oauth-response",
      handleOAuthResponse as EventListener
    )
    picker.addEventListener("picker-oauth-error", handleError as EventListener)
    picker.addEventListener("picker-error", handleError as EventListener)
    picker.addEventListener("picker-canceled", handleCanceled as EventListener)
    picker.addEventListener("picker-picked", handlePicked as EventListener)
    document.body.append(picker)
    picker.visible = true
  })
}
