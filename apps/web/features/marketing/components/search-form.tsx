import { SearchIcon } from "lucide-react"

import { MarketingButton } from "./button"

interface MarketingSearchFormProps {
  action: string
  label: string
  placeholder: string
  submitLabel: string
  defaultValue?: string
}

const MarketingSearchForm = ({
  action,
  label,
  placeholder,
  submitLabel,
  defaultValue,
}: MarketingSearchFormProps) => {
  return (
    <form
      action={action}
      method="get"
      noValidate
      className="mx-auto flex w-full max-w-xl items-center gap-2"
    >
      <div className="relative flex-1">
        <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          name="q"
          defaultValue={defaultValue}
          aria-label={label}
          placeholder={placeholder}
          className="h-10 w-full rounded-md border border-foreground/10 bg-background/40 pr-3 pl-9 text-sm outline-hidden placeholder:text-muted-foreground focus:border-foreground/30"
        />
      </div>
      <MarketingButton type="submit" size="lg" variant="blue">
        {submitLabel}
      </MarketingButton>
    </form>
  )
}

export default MarketingSearchForm
