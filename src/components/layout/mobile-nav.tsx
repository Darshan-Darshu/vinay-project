"use client"

import { Menu } from "lucide-react"
import { useState } from "react"

import { RoleSidebar } from "@/components/layout/role-sidebar"
import { SignOutForm } from "@/components/layout/profile-block"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { AppRole } from "@/lib/permissions/roles"

export function MobileNav({ role }: { role: AppRole }) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" showCloseButton={false} className="flex h-full w-[240px] flex-col border-none bg-[#101a2c] p-0 text-white">
        <SheetHeader className="sr-only">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <RoleSidebar role={role} onNavigate={() => setOpen(false)} />
        <SignOutForm />
      </SheetContent>
    </Sheet>
  )
}
