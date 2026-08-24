"use client"

export function AiGenerationCanvas({
  aspectRatio,
  label,
  prompt,
  resolution,
}: {
  aspectRatio: string
  label: string
  prompt: string
  resolution?: string
}) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <div
        aria-label={label}
        className="relative isolate overflow-hidden rounded-xl border border-border bg-muted"
        role="img"
        style={{ aspectRatio }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:10px_10px] opacity-60"
        />
        <span
          aria-hidden="true"
          className="absolute inset-[-25%] [animation:generation-glow_4s_ease-in-out_infinite] rounded-full bg-primary/25 blur-3xl motion-reduce:animate-none"
        />
        {resolution ? (
          <span className="absolute right-2 bottom-2 rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {resolution}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="[animation:shimmer-text_1.4s_linear_infinite] bg-[linear-gradient(90deg,var(--muted-foreground)_35%,var(--foreground)_50%,var(--muted-foreground)_65%)] bg-[length:200%_100%] bg-clip-text text-sm font-medium text-transparent motion-reduce:animate-none motion-reduce:text-muted-foreground">
          {label}
        </span>
        <span className="truncate text-sm text-muted-foreground">
          “{prompt}”
        </span>
      </div>
    </div>
  )
}
