"use client"

import { useState } from "react"
import { Check, ChevronDown, Sparkles } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

export type TraceStep = {
  detail?: string
  label: string
  state: "done" | "active" | "pending"
}

export function AiThinkingTrace({
  activeLabel,
  doneLabel,
  steps,
  working,
}: {
  activeLabel: string
  doneLabel: string
  steps: readonly TraceStep[]
  working: boolean
}) {
  const [expanded, setExpanded] = useState<boolean | null>(null)
  const isOpen = expanded ?? working

  return (
    <div className="flex w-full flex-col">
      <button
        aria-expanded={isOpen}
        className="-mx-1.5 flex w-fit items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/60"
        onClick={() => setExpanded(!isOpen)}
        type="button"
      >
        <Sparkles
          aria-hidden="true"
          className={cn(
            "size-4",
            working ? "text-foreground" : "text-muted-foreground"
          )}
        />
        {working ? (
          <span className="[animation:shimmer-text_1.4s_linear_infinite] bg-[linear-gradient(90deg,var(--muted-foreground)_35%,var(--foreground)_50%,var(--muted-foreground)_65%)] bg-[length:200%_100%] bg-clip-text text-sm font-medium whitespace-nowrap text-transparent motion-reduce:animate-none motion-reduce:text-muted-foreground">
            {activeLabel}
          </span>
        ) : (
          <span className="text-sm font-medium whitespace-nowrap text-muted-foreground">
            {doneLabel}
          </span>
        )}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3.5 text-muted-foreground transition-transform duration-300",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
        style={{
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <div className="relative mt-1 ml-[5px] border-l border-border pl-4">
            <div className="flex flex-col gap-1 py-1">
              {steps.map((step, index) => (
                <div
                  className="flex min-h-7 [animation:fade-up_320ms_ease-out_both] items-center gap-2 rounded-md px-1.5 py-0.5 motion-reduce:animate-none"
                  key={step.label}
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  {step.state === "active" ? (
                    <span
                      aria-hidden="true"
                      className="size-3 shrink-0 animate-spin rounded-full border-[1.5px] border-border border-t-foreground motion-reduce:animate-none"
                    />
                  ) : (
                    <Check
                      aria-hidden="true"
                      className={cn(
                        "size-3.5 shrink-0",
                        step.state === "done"
                          ? "text-muted-foreground"
                          : "text-border"
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "min-w-0 truncate text-sm",
                      step.state === "pending"
                        ? "text-muted-foreground"
                        : "font-medium text-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                  {step.detail ? (
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {step.detail}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
