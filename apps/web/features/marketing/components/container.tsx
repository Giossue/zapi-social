"use client"

import { motion } from "motion/react"

import { cn } from "@workspace/ui/lib/utils"

interface ContainerProps {
  className?: string
  children: React.ReactNode
  delay?: number
  reverse?: boolean
  simple?: boolean
}

const Container = ({
  children,
  className,
  delay = 0.2,
  reverse,
  simple,
}: ContainerProps) => {
  return (
    <motion.div
      className={cn("h-full w-full", className)}
      initial={{ opacity: 0, y: reverse ? -20 : 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={
        simple
          ? { delay, duration: 0.2, type: "keyframes" }
          : { delay, duration: 0.4, type: "spring" }
      }
    >
      {children}
    </motion.div>
  )
}

export default Container
