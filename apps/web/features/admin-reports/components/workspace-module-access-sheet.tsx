"use client"

import { Check } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@workspace/ui/components/field"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetActions,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Spinner } from "@workspace/ui/components/spinner"

export type WorkspaceModuleOption = {
  available: boolean
  enabled: boolean
  key: string
  label: string
}

type WorkspaceModuleAccessSheetProps = {
  cancelLabel: string
  description: string
  disabledDescription: string
  groupDescription: string
  groupLabel: string
  modules: readonly WorkspaceModuleOption[]
  onOpenChange: (open: boolean) => void
  onSave: () => void
  onToggle: (key: string, enabled: boolean) => void
  open: boolean
  saveLabel: string
  saving: boolean
  savingLabel: string
  title: string
}

export function WorkspaceModuleAccessSheet({
  cancelLabel,
  description,
  disabledDescription,
  groupDescription,
  groupLabel,
  modules,
  onOpenChange,
  onSave,
  onToggle,
  open,
  saveLabel,
  saving,
  savingLabel,
  title,
}: WorkspaceModuleAccessSheetProps) {
  return (
    <Sheet onOpenChange={(next) => !saving && onOpenChange(next)} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b pr-12">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            onSave()
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <FieldSet disabled={saving}>
              <FieldLegend variant="label">{groupLabel}</FieldLegend>
              <FieldDescription>{groupDescription}</FieldDescription>
              <FieldGroup className="grid sm:grid-cols-2">
                {modules.map((module) => (
                  <Field
                    data-disabled={!module.available || saving || undefined}
                    key={module.key}
                    orientation="horizontal"
                  >
                    <Checkbox
                      checked={module.enabled}
                      disabled={!module.available || saving}
                      id={`workspace-module-${module.key}`}
                      onCheckedChange={(checked) =>
                        onToggle(module.key, checked === true)
                      }
                    />
                    <div className="flex flex-col gap-0.5">
                      <FieldLabel htmlFor={`workspace-module-${module.key}`}>
                        {module.label}
                      </FieldLabel>
                      {!module.available ? (
                        <FieldDescription>
                          {disabledDescription}
                        </FieldDescription>
                      ) : null}
                    </div>
                  </Field>
                ))}
              </FieldGroup>
            </FieldSet>
          </div>
          <SheetActions>
            <Button
              disabled={saving}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="brand-secondary"
            >
              {cancelLabel}
            </Button>
            <Button disabled={saving} type="submit">
              {saving ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Check aria-hidden="true" data-icon="inline-start" />
              )}
              {saving ? savingLabel : saveLabel}
            </Button>
          </SheetActions>
        </form>
      </SheetContent>
    </Sheet>
  )
}
