"use client"

import { ArrowRightIcon, Menu } from "lucide-react"
import Link from "next/link"

import { Button } from "@workspace/ui/components/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"

interface MobileMenuProps {
  ctaHref: string
  ctaLabel: string
  menuLabel: string
  links: { href: string; label: string }[]
}

const MobileMenu = ({
  ctaHref,
  ctaLabel,
  menuLabel,
  links,
}: MobileMenuProps) => {
  return (
    <Sheet>
      <SheetTrigger asChild className="lg:hidden">
        <Button
          variant="brand-secondary"
          size="icon-lg"
          aria-label={menuLabel}
          className="lg:hidden"
        >
          <Menu className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full pt-12 sm:w-[300px]">
        <SheetHeader className="mb-8">
          <SheetTitle className="text-left">{menuLabel}</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col space-y-4 px-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-base font-medium transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-4 border-t border-border pt-4">
            <Link href={ctaHref} className="w-full">
              <Button size="lg" className="w-full">
                {ctaLabel}
                <ArrowRightIcon className="size-4" />
              </Button>
            </Link>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  )
}

export default MobileMenu
