"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Check,
  Image,
  Play,
  Search,
  Shapes,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
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

import { FilesPermissionState } from "@/features/files/components/files-states"
import type {
  OnlineMediaItem,
  OnlineMediaSearchData,
} from "@/features/files/types/files"

const mediaKindMeta: Record<
  OnlineMediaItem["kind"],
  { icon: typeof Image; label: string }
> = {
  illustration: { icon: Shapes, label: "Ilustración" },
  photo: { icon: Image, label: "Foto" },
  video: { icon: Play, label: "Video" },
}

function mediaMatches(item: OnlineMediaItem, query: string) {
  const normalized = query.trim().toLocaleLowerCase("es")

  return (
    normalized.length === 0 ||
    item.title.toLocaleLowerCase("es").includes(normalized) ||
    item.provider.toLocaleLowerCase("es").includes(normalized)
  )
}

export function OnlineMediaSearchPage({
  search,
}: {
  search: OnlineMediaSearchData
}) {
  const [query, setQuery] = useState(search.query)
  const [savedItemIds, setSavedItemIds] = useState<string[]>([])
  const [savedMessage, setSavedMessage] = useState<string | null>(null)

  const results = useMemo(
    () => search.items.filter((item) => mediaMatches(item, query)),
    [query, search.items]
  )

  function saveItem(item: OnlineMediaItem) {
    if (savedItemIds.includes(item.id)) return

    setSavedItemIds((current) => [...current, item.id])
    setSavedMessage(`“${item.title}” se añadió a la selección mock.`)
  }

  if (!search.canSearch) return <FilesPermissionState mode="search" />

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

      {savedMessage ? (
        <Alert>
          <Check aria-hidden="true" />
          <AlertTitle>Medio preparado</AlertTitle>
          <AlertDescription>{savedMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{results.length} resultados</p>
        <p className="text-sm text-muted-foreground">
          Resultados sintéticos de proveedores de referencia.
        </p>
      </div>

      {results.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={() => setQuery(search.query)} variant="brand-secondary">
              Restaurar búsqueda
            </Button>
          }
          description="Intenta una búsqueda más amplia para consultar el catálogo de referencia."
          icon={Search}
          title="No encontramos medios"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((item) => {
            const { icon: MediaIcon, label } = mediaKindMeta[item.kind]
            const saved = savedItemIds.includes(item.id)

            return (
              <Card key={item.id} variant="subtle">
                <CardHeader>
                  <div className="flex h-32 items-center justify-center rounded-lg bg-muted">
                    <MediaIcon aria-hidden="true" className="size-8 text-muted-foreground" />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="truncate">{item.title}</CardTitle>
                    <Badge variant="neutral">{label}</Badge>
                  </div>
                  <CardDescription>{item.provider}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {item.photographer} · {item.dimensions}
                  </p>
                </CardContent>
                <CardFooter className="justify-between">
                  <span className="text-xs text-muted-foreground">
                    {saved ? "En selección" : "Disponible"}
                  </span>
                  <Button
                    disabled={saved}
                    onClick={() => saveItem(item)}
                    size="sm"
                    variant={saved ? "success" : "brand-secondary"}
                  >
                    {saved ? <Check data-icon="inline-start" /> : <Image data-icon="inline-start" />}
                    {saved ? "Añadido" : "Añadir"}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
