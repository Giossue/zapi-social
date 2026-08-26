import React from "react"

import { cn } from "@workspace/ui/lib/utils"

interface WrapperProps {
  className?: string
  children: React.ReactNode
}

const Wrapper = ({ children, className }: WrapperProps) => {
  return (
    <div className={cn("mx-auto w-full px-4 md:px-12 lg:max-w-7xl", className)}>
      {children}
    </div>
  )
}

export default Wrapper
