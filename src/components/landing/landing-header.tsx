"use client"

import { Menu } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

const links = [
  { href: "#about", label: "About" },
  { href: "#academics", label: "Academics" },
  { href: "#campus", label: "Campus life" },
  { href: "#admissions", label: "Admissions" },
  { href: "#visit", label: "Visit" },
]

export function LandingHeader({ collegeName }: { collegeName: string }) {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-[#e7edf5] bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-5">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#101a2c] text-sm font-semibold text-white">
            {collegeName.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate text-sm font-semibold">{collegeName}</span>
        </Link>
        <nav aria-label="Page" className="ml-auto hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-xl px-3 py-2 text-sm text-[#5c677a] hover:bg-[#f4f6fb] hover:text-[#243044]"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <Button className="ml-auto rounded-xl bg-[#f3b7d4] text-[#243044] hover:bg-[#f3b7d4]/90 lg:ml-2" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>{collegeName}</SheetTitle>
            </SheetHeader>
            <nav aria-label="Page" className="flex flex-col gap-1 px-4">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-3 text-sm hover:bg-[#f4f6fb]"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
