import {
  ChartColumnBigIcon,
  DatabaseIcon,
  type LucideIcon,
  TrendingUpIcon,
  WandSparklesIcon,
  ZapIcon,
} from "lucide-react"

export interface MarketingFeature {
  key: "multiAccount" | "metrics" | "library" | "calendar" | "ai"
  icon: LucideIcon
  image: string
}

export const MARKETING_FEATURES: MarketingFeature[] = [
  {
    key: "multiAccount",
    icon: WandSparklesIcon,
    image: "/marketing/feature-two.svg",
  },
  {
    key: "metrics",
    icon: ChartColumnBigIcon,
    image: "/marketing/feature-one.svg",
  },
  {
    key: "library",
    icon: DatabaseIcon,
    image: "/marketing/feature-three.svg",
  },
  {
    key: "calendar",
    icon: TrendingUpIcon,
    image: "/marketing/feature-four.svg",
  },
  { key: "ai", icon: ZapIcon, image: "/marketing/feature-five.svg" },
]
