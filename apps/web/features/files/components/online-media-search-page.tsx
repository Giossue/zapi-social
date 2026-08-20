"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Image, Play, Search } from "lucide-react"

import { ApiError, onlineMediaApi } from "@workspace/api-client"
import type { PortalOnlineMediaResult } from "@workspace/contracts"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { CardGrid } from "@workspace/ui/components/card-grid"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { PageLoading } from "@workspace/ui/components/page-loading"
import { RetryButton } from "@workspace/ui/components/retry-button"
import { Spinner } from "@workspace/ui/components/spinner"
import { toast } from "@workspace/ui/components/toast"

import { FilesPermissionState } from "@/features/files/components/files-states"

const typeMeta = {
  image: { icon: Image, label: "Imagen" },
  video: { icon: Play, label: "Video" },
} as const

const providerLabels = {
  unsplash: "Unsplash",
  pexels: "Pexels",
} as const

function dimensions(result: PortalOnlineMediaResult) {
  if (!result.width || !result.height) return null
  return `${result.width} × ${result.height}`
}

export function OnlineMediaSearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PortalOnlineMediaResult[]>([])
  const [total, setTotal] = useState(0)
  const [hasSearched, setHasSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [canSearch, setCanSearch] = useState(true)
  const [notConfigured, setNotConfigured] = useState(false)
  const [searchError, setSearchError] = useState(false)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [importedIds, setImportedIds] = useState<string[]>([])

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === "AUTH_SESSION_EXPIRED") {
        router.replace("/login")
        return true
      }
      if (error instanceof ApiError && error.status === 403) {
        setCanSearch(false)
        return true
      }
      return false
    },
    [router]
  )

  const search = useCallback(
    async (term: string) => {
      const normalized = term.trim()
      if (!normalized) {
        setResults([])
        setTotal(0)
        setHasSearched(false)
        return
      }

      setIsSearching(true)
      setSearchError(false)
      setNotConfigured(false)
      try {
        const response = await onlineMediaApi.search({ q: normalized })
        setResults(response.results)
        setTotal(response.total)
        setCanSearch(true)
      } catch (error) {
        if (handleError(error)) return
        if (
          error instanceof ApiError &&
          error.code === "ONLINE_MEDIA_PROVIDER_NOT_CONFIGURED"
        ) {
          setResults([])
          setTotal(0)
          setNotConfigured(true)
          return
        }
        console.error("Online media search failed", error)
        setResults([])
        setTotal(0)
        setSearchError(true)
      } finally {
        setHasSearched(true)
        setIsSearching(false)
      }
    },
    [handleError]
  )

  useEffect(() => {
    const timer = setTimeout(() => void search(query), 400)
    return () => clearTimeout(timer)
  }, [query, search])

  async function importResult(result: PortalOnlineMediaResult) {
    if (importedIds.includes(result.id)) return
    setImportingId(result.id)
    try {
      await onlineMediaApi.import({
        authorName: result.authorName,
        authorUrl: result.authorUrl,
        downloadUrl: result.downloadUrl,
        id: result.id,
        mimeType: result.mimeType,
        provider: result.provider,
        sourceUrl: result.sourceUrl,
        title: result.title,
        type: result.type,
      })
      setImportedIds((current) => [...current, result.id])
      toast.success(`“${result.title}” se guardó en tu biblioteca.`)
    } catch (error) {
      if (handleError(error)) return
      console.error("Online media import failed", error)
      toast.error("No pudimos importar este medio. Inténtalo de nuevo.")
    } finally {
      setImportingId(null)
    }
  }

  if (!canSearch) return <FilesPermissionState mode="search" />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <InputGroup className="max-w-2xl">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Buscar medios online"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca fotos, ilustraciones o videos"
            value={query}
          />
        </InputGroup>
        <Button asChild variant="brand-secondary">
          <Link href="/portal/files">
            <ArrowLeft data-icon="inline-start" />
            Volver a archivos
          </Link>
        </Button>
      </div>

      {hasSearched && results.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">
            {total} {total === 1 ? "resultado" : "resultados"}
          </p>
          <p className="text-sm text-muted-foreground">
            Importar guarda una copia en la biblioteca del espacio de trabajo.
          </p>
        </div>
      ) : null}

      {isSearching ? (
        <PageLoading aria-label="Buscando medios online" />
      ) : notConfigured ? (
        <EmptyState
          description="Ningún proveedor de medios está configurado para esta plataforma. Un administrador debe conectarlo antes de buscar."
          icon={Search}
          title="Búsqueda online no configurada"
        />
      ) : searchError ? (
        <EmptyState
          action={
            <RetryButton
              onClick={() => void search(query)}
              variant="brand-secondary"
            />
          }
          description="No pudimos completar la búsqueda."
          icon={Search}
          title="Búsqueda no disponible"
        />
      ) : !hasSearched ? (
        <EmptyState
          description="Escribe qué necesitas y buscaremos en los proveedores conectados."
          icon={Search}
          title="Busca un medio para empezar"
        />
      ) : results.length === 0 ? (
        <EmptyState
          description="Intenta una búsqueda más amplia o con otras palabras."
          icon={Search}
          title="No encontramos medios"
        />
      ) : (
        <CardGrid layout="xl-3">
          {results.map((result) => {
            const { icon: MediaIcon, label } = typeMeta[result.type]
            const imported = importedIds.includes(result.id)
            const importing = importingId === result.id
            const size = dimensions(result)

            return (
              <Card key={`${result.provider}-${result.id}`} variant="subtle">
                <CardHeader>
                  <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    <MediaIcon
                      aria-hidden="true"
                      className="size-8 text-muted-foreground"
                    />
                    <img
                      alt={result.title}
                      className="absolute inset-0 size-full object-cover"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = "none"
                      }}
                      src={result.previewUrl}
                    />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="truncate">{result.title}</CardTitle>
                    <Badge variant="neutral">{label}</Badge>
                  </div>
                  <CardDescription>
                    {providerLabels[result.provider]}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {result.authorName}
                    {size ? ` · ${size}` : ""}
                  </p>
                </CardContent>
                <CardFooter className="justify-between">
                  <span className="text-xs text-muted-foreground">
                    {imported ? "En tu biblioteca" : "Disponible"}
                  </span>
                  <Button
                    disabled={imported || importing}
                    onClick={() => void importResult(result)}
                    size="sm"
                    variant={imported ? "success" : "brand-secondary"}
                  >
                    {importing ? (
                      <Spinner data-icon="inline-start" />
                    ) : imported ? (
                      <Check data-icon="inline-start" />
                    ) : (
                      <Image data-icon="inline-start" />
                    )}
                    {imported ? "Importado" : "Importar"}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </CardGrid>
      )}
    </div>
  )
}
