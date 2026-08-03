"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, toast, type ToasterProps } from "sonner"

function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      closeButton
      position="top-center"
      richColors
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast !border-transparent shadow-sm",
          description: "text-muted-foreground",
          closeButton:
            "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
          error: "text-destructive",
          success: "text-success",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
