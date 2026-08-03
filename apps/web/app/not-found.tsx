import Link from "next/link"

import { Button } from "@workspace/ui/components/button"

export default function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center space-y-2 text-center">
      <h1 className="font-semibold text-2xl">Page not found.</h1>
      <p className="text-muted-foreground">
        The page you are looking for could not be found.
      </p>
      <Link replace href="/portal/dashboard">
        <Button variant="outline">Go back home</Button>
      </Link>
    </div>
  )
}
