import type {
  GoogleDriveIntegrationConfiguration,
  GoogleDrivePickerSelection,
} from "@workspace/contracts"

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

type TokenClient = {
  callback: (response: GoogleTokenResponse) => void
  requestAccessToken: (options?: { prompt?: string }) => void
}

type PickerBuilder = {
  addView: (view: unknown) => PickerBuilder
  enableFeature: (feature: unknown) => PickerBuilder
  setAppId: (appId: string) => PickerBuilder
  setCallback: (callback: (data: PickerResponse) => void) => PickerBuilder
  setDeveloperKey: (key: string) => PickerBuilder
  setOAuthToken: (token: string) => PickerBuilder
  setOrigin: (origin: string) => PickerBuilder
  build: () => { setVisible: (visible: boolean) => void }
}

type DocsView = {
  setIncludeFolders: (value: boolean) => DocsView
  setMimeTypes: (value: string) => DocsView
  setSelectFolderEnabled: (value: boolean) => DocsView
}

type GoogleRuntime = Window & {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (options: {
          client_id: string
          scope: string
          callback: (response: GoogleTokenResponse) => void
          error_callback?: () => void
        }) => TokenClient
      }
    }
    picker?: {
      Action: { CANCEL: string; PICKED: string }
      DocsView: new () => DocsView
      Feature: { MULTISELECT_ENABLED: unknown; SUPPORT_DRIVES: unknown }
      PickerBuilder: new () => PickerBuilder
    }
  }
  gapi?: { load: (name: string, callback: () => void) => void }
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

let scriptsPromise: Promise<void> | null = null

function loadScript(id: string, src: string) {
  const existing = document.getElementById(id) as HTMLScriptElement | null
  if (existing?.dataset.loaded === "true") return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const script = existing ?? document.createElement("script")
    const onLoad = () => {
      script.dataset.loaded = "true"
      resolve()
    }
    script.addEventListener("load", onLoad, { once: true })
    script.addEventListener("error", () => reject(new Error("SCRIPT_FAILED")), {
      once: true,
    })
    if (!existing) {
      script.id = id
      script.src = src
      document.head.append(script)
    }
  })
}

async function loadGooglePickerRuntime() {
  scriptsPromise ??= Promise.all([
    loadScript("google-api-script", "https://apis.google.com/js/api.js"),
    loadScript(
      "google-identity-script",
      "https://accounts.google.com/gsi/client"
    ),
  ]).then(() => undefined)
  await scriptsPromise
  const runtime = window as GoogleRuntime
  await new Promise<void>((resolve, reject) => {
    if (!runtime.gapi) {
      reject(new Error("GOOGLE_RUNTIME_UNAVAILABLE"))
      return
    }
    runtime.gapi.load("picker", resolve)
  })
  if (!runtime.google?.accounts?.oauth2 || !runtime.google.picker) {
    throw new Error("GOOGLE_RUNTIME_UNAVAILABLE")
  }
  return runtime
}

export type GoogleDrivePickerResult = {
  accessToken: string
  credentialExpiresAt: string
  files: GoogleDrivePickerSelection[]
}

export async function openGoogleDrivePicker({
  configuration,
  multiselect,
}: {
  configuration: GoogleDriveIntegrationConfiguration
  multiselect: boolean
}): Promise<GoogleDrivePickerResult | null> {
  const runtime = await loadGooglePickerRuntime()
  const oauth2 = runtime.google!.accounts!.oauth2!
  const picker = runtime.google!.picker!

  const token = await new Promise<GoogleTokenResponse | null>(
    (resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: configuration.oauthClientId,
        scope: GOOGLE_SCOPE,
        callback: resolve,
        error_callback: () => resolve(null),
      })
      try {
        client.requestAccessToken({ prompt: "select_account" })
      } catch (error) {
        reject(error)
      }
    }
  )
  if (!token || token.error) return null
  if (!token.access_token || !token.expires_in) {
    throw new Error("GOOGLE_AUTH_FAILED")
  }

  const files = await new Promise<GoogleDrivePickerSelection[] | null>(
    (resolve) => {
      const view = new picker.DocsView()
        .setIncludeFolders(false)
        .setSelectFolderEnabled(false)
        .setMimeTypes(MEDIA_MIME_TYPES)
      let builder = new picker.PickerBuilder()
        .setAppId(configuration.appId)
        .setDeveloperKey(configuration.browserApiKey)
        .setOAuthToken(token.access_token!)
        .setOrigin(window.location.origin)
        .addView(view)
        .enableFeature(picker.Feature.SUPPORT_DRIVES)
        .setCallback((data) => {
          if (data.action === picker.Action.CANCEL) {
            resolve(null)
            return
          }
          if (data.action !== picker.Action.PICKED) return
          const selections = (data.docs ?? []).flatMap((document) =>
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
          resolve(selections.length ? selections : null)
        })
      if (multiselect) {
        builder = builder.enableFeature(picker.Feature.MULTISELECT_ENABLED)
      }
      builder.build().setVisible(true)
    }
  )
  if (!files) return null
  return {
    accessToken: token.access_token,
    credentialExpiresAt: new Date(
      Date.now() + Math.max(30, token.expires_in - 30) * 1000
    ).toISOString(),
    files,
  }
}
