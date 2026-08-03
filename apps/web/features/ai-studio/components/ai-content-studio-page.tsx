"use client"

import { useState } from "react"
import {
  Bot,
  Check,
  CircleAlert,
  Copy,
  FileText,
  LoaderCircle,
  Send,
  Sparkles,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Bubble, BubbleContent, BubbleGroup } from "@workspace/ui/components/bubble"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { EmptyState } from "@workspace/ui/components/empty-state"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@workspace/ui/components/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Textarea } from "@workspace/ui/components/textarea"

import { createAIContentResultsMock } from "@/features/ai-studio/mocks/ai-content-repository"
import type {
  AIContentResult,
  AIContentStudioData,
} from "@/features/ai-studio/types/ai-content"

const platforms = ["Facebook", "Instagram", "LinkedIn"] as const

function AIContentResultCard({ result }: { result: AIContentResult }) {
  const [copied, setCopied] = useState(false)

  return (
    <Card variant="subtle">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{result.title}</CardTitle>
          <Button
            aria-label={`Copiar ${result.title}`}
            onClick={() => setCopied(true)}
            size="icon-sm"
            variant="brand-secondary"
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed">{result.content}</p>
        <div className="flex flex-wrap gap-1.5">
          {result.tags.map((tag) => (
            <Badge key={tag} variant="neutral">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <span className="text-xs text-muted-foreground">
          {copied ? "Copiado en este mock" : "Resultado generado con datos mock"}
        </span>
      </CardFooter>
    </Card>
  )
}

export function AIContentLoading() {
  return (
    <div aria-busy="true" className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)_18rem]">
      <Skeleton className="h-96" />
      <Skeleton className="h-[34rem]" />
      <Skeleton className="h-96" />
    </div>
  )
}

export function AIContentStudioPage({ data }: { data: AIContentStudioData }) {
  const [activeTemplateId, setActiveTemplateId] = useState(data.templates[0]?.id ?? "")
  const [prompt, setPrompt] = useState(data.templates[0]?.prompt ?? "")
  const [tone, setTone] = useState("Cercano")
  const [selectedPlatforms, setSelectedPlatforms] = useState<readonly string[]>(
    platforms
  )
  const [results, setResults] = useState<readonly AIContentResult[]>(
    data.initialResults
  )
  const [promptError, setPromptError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  function selectTemplate(templateId: string) {
    const template = data.templates.find((item) => item.id === templateId)
    if (!template) return

    setActiveTemplateId(template.id)
    setPrompt(template.prompt)
    setPromptError(null)
  }

  function togglePlatform(platform: string, checked: boolean) {
    setSelectedPlatforms((current) => {
      if (checked) return [...new Set([...current, platform])]
      return current.filter((item) => item !== platform)
    })
  }

  function generate() {
    const normalizedPrompt = prompt.trim()

    if (!normalizedPrompt) {
      setPromptError("Describe el contenido que quieres crear antes de generar.")
      return
    }

    if (selectedPlatforms.length === 0) {
      setPromptError("Selecciona al menos una plataforma para crear las versiones.")
      return
    }

    setPromptError(null)
    setIsGenerating(true)

    window.setTimeout(() => {
      setResults(createAIContentResultsMock(normalizedPrompt))
      setIsGenerating(false)
    }, 450)
  }

  if (!data.canUse) {
    return (
      <EmptyState
        description="Tu acceso actual no incluye la generación de contenido para este espacio de trabajo."
        icon={Sparkles}
        title="AI Studio no está disponible"
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Selecciona una base, ajusta el enfoque y revisa las versiones antes de usarlas.
        </p>
        <Badge variant="info">{data.creditsAvailable} créditos mock</Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-[17rem_minmax(0,1fr)_18rem]">
        <Card size="sm" variant="subtle">
          <CardHeader>
            <CardTitle>Comenzar con una base</CardTitle>
            <CardDescription>
              Usa una plantilla o continúa desde un borrador reciente.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.templates.map((template) => {
              const selected = template.id === activeTemplateId

              return (
                <Card key={template.id} size="sm" variant={selected ? "interactive" : "inset"}>
                  <CardContent className="flex flex-col gap-2">
                    <p className="font-medium">{template.title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {template.description}
                    </p>
                    <Button
                      onClick={() => selectTemplate(template.id)}
                      size="sm"
                      variant="brand-secondary"
                    >
                      {selected ? "Seleccionada" : "Usar plantilla"}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2">
            <p className="text-xs font-medium text-muted-foreground">Borradores recientes</p>
            {data.drafts.map((draft) => (
              <div className="flex min-w-0 items-start gap-2" key={draft.id}>
                <FileText aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{draft.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{draft.updatedAt}</p>
                </div>
              </div>
            ))}
          </CardFooter>
        </Card>

        <Card variant="surface">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Conversación de contenido</CardTitle>
                <CardDescription>
                  El resultado se genera localmente a partir de tu briefing.
                </CardDescription>
              </div>
              <Bot aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <BubbleGroup>
              <Bubble align="start" variant="muted">
                <BubbleContent>
                  Cuéntame qué quieres comunicar. Prepararé dos versiones para las plataformas que selecciones.
                </BubbleContent>
              </Bubble>
              <Bubble align="end" variant="default">
                <BubbleContent>{prompt || "Escribe un briefing para comenzar."}</BubbleContent>
              </Bubble>
            </BubbleGroup>

            {isGenerating ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                Preparando versiones mock…
              </div>
            ) : (
              <div className="grid gap-3">
                {results.map((result) => (
                  <AIContentResultCard key={result.id} result={result} />
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-3">
            {promptError ? (
              <Alert variant="destructive">
                <CircleAlert aria-hidden="true" />
                <AlertTitle>Revisa el briefing</AlertTitle>
                <AlertDescription>{promptError}</AlertDescription>
              </Alert>
            ) : null}
            <Field data-invalid={Boolean(promptError)}>
              <FieldLabel htmlFor="ai-content-prompt">Briefing</FieldLabel>
              <Textarea
                aria-invalid={Boolean(promptError)}
                id="ai-content-prompt"
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe la idea, el contexto y la acción esperada."
                value={prompt}
              />
              <FieldError>{promptError}</FieldError>
            </Field>
            <Button disabled={isGenerating} onClick={generate}>
              {isGenerating ? (
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
              ) : (
                <Send data-icon="inline-start" />
              )}
              Generar versiones
            </Button>
          </CardFooter>
        </Card>

        <Card size="sm" variant="subtle">
          <CardHeader>
            <CardTitle>Enfoque</CardTitle>
            <CardDescription>
              Estas preferencias solo afectan el resultado visual mock.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="ai-content-tone">Tono</FieldLabel>
                <Select onValueChange={setTone} value={tone}>
                  <SelectTrigger className="w-full" id="ai-content-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="Cercano">Cercano</SelectItem>
                      <SelectItem value="Profesional">Profesional</SelectItem>
                      <SelectItem value="Inspirador">Inspirador</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Seleccionado: {tone.toLocaleLowerCase("es")}.
                </FieldDescription>
              </Field>
              <FieldSet>
                <FieldTitle>Plataformas</FieldTitle>
                <FieldDescription>
                  Crea versiones con el contexto de cada canal.
                </FieldDescription>
                {platforms.map((platform) => {
                  const id = `ai-platform-${platform.toLocaleLowerCase("es")}`
                  const checked = selectedPlatforms.includes(platform)

                  return (
                    <Field key={platform} orientation="horizontal">
                      <Checkbox
                        checked={checked}
                        id={id}
                        onCheckedChange={(nextChecked) =>
                          togglePlatform(platform, nextChecked === true)
                        }
                      />
                      <FieldLabel htmlFor={id}>{platform}</FieldLabel>
                    </Field>
                  )
                })}
              </FieldSet>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
