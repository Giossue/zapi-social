import type { ComponentType, ReactNode, SVGProps } from "react"

export function IntegrationSection({
  children,
  icon: Icon,
  title,
}: {
  children: ReactNode
  icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  )
}
