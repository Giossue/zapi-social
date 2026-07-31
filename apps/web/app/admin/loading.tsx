import { Skeleton } from "@workspace/ui/components/skeleton"

export default function AdminLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando administración">
      <section className="space-y-3">
        <Skeleton className="h-5 w-52" />
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => <Skeleton key={item} className="h-36" />)}
      </section>
      <Skeleton className="h-64" />
    </div>
  )
}
