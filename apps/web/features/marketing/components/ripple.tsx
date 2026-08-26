import React, { type CSSProperties } from "react"

import { cn } from "@workspace/ui/lib/utils"

interface RippleProps {
  mainCircleSize?: number
  mainCircleOpacity?: number
  numCircles?: number
  className?: string
}

const Ripple = React.memo(function Ripple({
  mainCircleSize = 170,
  mainCircleOpacity = 0.24,
  numCircles = 6,
  className,
}: RippleProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,white,transparent)] select-none",
        className
      )}
    >
      {Array.from({ length: numCircles }, (_, i) => {
        const size = mainCircleSize + i * 110
        const opacity = mainCircleOpacity - i * 0.03
        const borderOpacity = 5 + i * 5

        return (
          <div
            key={i}
            className="absolute animate-ripple rounded-full border bg-foreground/25 shadow-xl"
            style={
              {
                "--i": i,
                width: `${size}px`,
                height: `${size}px`,
                opacity,
                animationDelay: `${i * 0.06}s`,
                borderStyle: i === numCircles - 1 ? "dashed" : "solid",
                borderWidth: "1px",
                borderColor: `color-mix(in oklab, var(--foreground) ${borderOpacity}%, transparent)`,
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%) scale(1)",
              } as CSSProperties
            }
          />
        )
      })}
    </div>
  )
})

export default Ripple
