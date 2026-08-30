import type { ComponentProps } from "react"

export function AiAgentIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      role="img"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        d="M3.75 10C3.75 7.1 6.1 4.75 9 4.75h6a5.25 5.25 0 1 1 0 10.5H9A5.25 5.25 0 0 1 3.75 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        height="4.5"
        rx="2.25"
        stroke="currentColor"
        strokeWidth="1.5"
        width="10.5"
        x="6.75"
        y="7.75"
      />
      <path
        d="M21.25 21v-.5c0-2.9-2.35-5.25-5.25-5.25H8a5.25 5.25 0 0 0-5.25 5.25v.5M12 1v3.75"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}
