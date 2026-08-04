import { cn } from "@workspace/ui/lib/utils"

type SpinnerProps = React.ComponentProps<"div"> & {
  size?: number
}

const bars = [
  { animationDelay: "-1.2s", transform: "rotate(.0001deg) translate(146%)" },
  { animationDelay: "-1.1s", transform: "rotate(30deg) translate(146%)" },
  { animationDelay: "-1.0s", transform: "rotate(60deg) translate(146%)" },
  { animationDelay: "-0.9s", transform: "rotate(90deg) translate(146%)" },
  { animationDelay: "-0.8s", transform: "rotate(120deg) translate(146%)" },
  { animationDelay: "-0.7s", transform: "rotate(150deg) translate(146%)" },
  { animationDelay: "-0.6s", transform: "rotate(180deg) translate(146%)" },
  { animationDelay: "-0.5s", transform: "rotate(210deg) translate(146%)" },
  { animationDelay: "-0.4s", transform: "rotate(240deg) translate(146%)" },
  { animationDelay: "-0.3s", transform: "rotate(270deg) translate(146%)" },
  { animationDelay: "-0.2s", transform: "rotate(300deg) translate(146%)" },
  { animationDelay: "-0.1s", transform: "rotate(330deg) translate(146%)" },
] as const

function Spinner({ className, size = 20, ...props }: SpinnerProps) {
  return (
    <div
      aria-label="Loading"
      data-slot="spinner"
      role="status"
      className={cn(
        "relative inline-block shrink-0 align-middle text-muted-foreground",
        className
      )}
      style={{ height: size, width: size }}
      {...props}
    >
      <div className="absolute top-1/2 left-1/2 size-full">
        {bars.map((bar) => (
          <span
            className="absolute -top-[3.9%] -left-[10%] h-[8%] w-[24%] animate-[spinner-fade_1.2s_linear_infinite] rounded-[5px] bg-current"
            key={bar.transform}
            style={bar}
          />
        ))}
      </div>
    </div>
  )
}

export { Spinner }
