"use client"

import { useState, type FormEvent } from "react"
import { Plus } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Textarea } from "@workspace/ui/components/textarea"
import { toast } from "@workspace/ui/components/toast"
import { useTranslations } from "next-intl"

import type { SupportCatalogItem } from "./support-catalog-panel"

export type AdminSupportUserFixture = {
  id: string
  name: string
  email: string
  workspaceName: string
}

export type NewCaseValues = {
  userId: string
  categoryId: string
  typeId: string
  labelIds: string[]
  subject: string
  message: string
}

function RequiredMark() {
  return (
    <span aria-hidden="true" className="text-destructive">
      *
    </span>
  )
}

export function AdminSupportNewCaseSheet({
  categories,
  labels,
  onCreate,
  onOpenChange,
  open,
  types,
  users,
}: {
  categories: readonly SupportCatalogItem[]
  labels: readonly SupportCatalogItem[]
  onCreate: (values: NewCaseValues) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  types: readonly SupportCatalogItem[]
  users: readonly AdminSupportUserFixture[]
}) {
  const t = useTranslations("adminSupport")
  const [userId, setUserId] = useState("")
  const [categoryId, setCategoryId] = useState("none")
  const [typeId, setTypeId] = useState("none")
  const [labelIds, setLabelIds] = useState<string[]>([])
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const complete = Boolean(userId && subject.trim() && message.trim())
  const activeLabels = labels.filter((label) => label.isActive)

  function close() {
    setUserId("")
    setCategoryId("none")
    setTypeId("none")
    setLabelIds([])
    setSubject("")
    setMessage("")
    onOpenChange(false)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!complete) {
      toast.error(t("missingFields"))
      return
    }
    onCreate({
      userId,
      categoryId,
      typeId,
      labelIds,
      subject: subject.trim(),
      message: message.trim(),
    })
    toast.success(t("caseCreated"))
    close()
  }

  return (
    <Sheet
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      open={open}
    >
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>{t("newCase")}</SheetTitle>
          <SheetDescription>{t("newCaseDescription")}</SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          noValidate
          onSubmit={submit}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="admin-case-user">
                  {t("targetUser")} <RequiredMark />
                </FieldLabel>
                <Select onValueChange={setUserId} value={userId}>
                  <SelectTrigger
                    aria-required="true"
                    className="w-full"
                    id="admin-case-user"
                  >
                    <SelectValue placeholder={t("selectPerson")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} · {user.email}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>{t("targetUserHelp")}</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-case-category">
                  {t("category")}
                </FieldLabel>
                <Select onValueChange={setCategoryId} value={categoryId}>
                  <SelectTrigger className="w-full" id="admin-case-category">
                    <SelectValue placeholder={t("selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">{t("noCategory")}</SelectItem>
                      {categories
                        .filter((category) => category.isActive)
                        .map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-case-type">{t("type")}</FieldLabel>
                <Select onValueChange={setTypeId} value={typeId}>
                  <SelectTrigger className="w-full" id="admin-case-type">
                    <SelectValue placeholder={t("selectType")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="none">{t("noType")}</SelectItem>
                      {types
                        .filter((type) => type.isActive)
                        .map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <FieldSet>
                <FieldLabel asChild>
                  <legend>{t("labels")}</legend>
                </FieldLabel>
                {activeLabels.length ? (
                  <FieldGroup className="gap-3" data-slot="checkbox-group">
                    {activeLabels.map((label) => (
                      <Field key={label.id} orientation="horizontal">
                        <Checkbox
                          checked={labelIds.includes(label.id)}
                          id={`admin-case-label-${label.id}`}
                          onCheckedChange={(checked) =>
                            setLabelIds((current) =>
                              checked === true
                                ? [...current, label.id]
                                : current.filter((id) => id !== label.id)
                            )
                          }
                        />
                        <FieldLabel htmlFor={`admin-case-label-${label.id}`}>
                          <FieldContent>
                            <FieldTitle>{label.name}</FieldTitle>
                          </FieldContent>
                        </FieldLabel>
                      </Field>
                    ))}
                  </FieldGroup>
                ) : (
                  <FieldDescription>{t("noActiveLabels")}</FieldDescription>
                )}
              </FieldSet>
              <Field>
                <FieldLabel htmlFor="admin-case-subject">
                  {t("subject")} <RequiredMark />
                </FieldLabel>
                <Input
                  aria-required="true"
                  id="admin-case-subject"
                  onChange={(event) => setSubject(event.target.value)}
                  value={subject}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-case-message">
                  {t("message")} <RequiredMark />
                </FieldLabel>
                <Textarea
                  aria-required="true"
                  id="admin-case-message"
                  onChange={(event) => setMessage(event.target.value)}
                  rows={6}
                  value={message}
                />
              </Field>
            </FieldGroup>
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button onClick={close} type="button" variant="brand-secondary">
              {t("cancel")}
            </Button>
            <Button disabled={!complete} type="submit">
              <Plus data-icon="inline-start" /> {t("createCase")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
