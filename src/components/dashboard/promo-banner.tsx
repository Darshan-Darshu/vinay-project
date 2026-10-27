"use client"

import { X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { Button } from "@/components/ui/button"

export function PromoBanner({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string
  description: string
  actionHref: string
  actionLabel: string
}) {
  const [open, setOpen] = useState(true)
  if (!open) return null

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-[#101a2c] px-6 py-8 text-white">
      <div className="pointer-events-none absolute -bottom-8 -left-4 h-24 w-40 rounded-[40%] bg-[#2f6b4f]" />
      <div className="pointer-events-none absolute -bottom-6 left-16 h-20 w-28 rounded-[40%] bg-[#3d8f62]" />
      <div className="pointer-events-none absolute right-0 -bottom-8 h-28 w-48 rounded-[40%] bg-[#2f6b4f]" />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="absolute top-4 right-4 rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
      <div className="relative mx-auto max-w-lg text-center">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-white/70">{description}</p>
        <Button asChild className="mt-4 rounded-xl bg-[#f3b7d4] px-5 text-[#243044] hover:bg-[#f3b7d4]/90">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </div>
    </section>
  )
}
