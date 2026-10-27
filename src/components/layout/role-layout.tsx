import { connection } from "next/server"
import { cache, Suspense } from "react"

import { RoleChatDock } from "@/components/academics/chat-dock"
import { ConfigNotice } from "@/components/dashboard/config-notice"
import { CachedCampusShell } from "@/components/layout/cached-campus-shell"
import { MobileNav } from "@/components/layout/mobile-nav"
import { PortalSearch } from "@/components/layout/portal-search"
import { ProfileBlock, SignOutForm } from "@/components/layout/profile-block"
import { RoleSidebar } from "@/components/layout/role-sidebar"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Skeleton } from "@/components/ui/skeleton"
import { requireRole } from "@/lib/auth/session"
import type { AppRole } from "@/lib/permissions/roles"
import { getSupabasePublicEnv } from "@/lib/supabase/env"

const loadProfile = cache(async (role: AppRole) => requireRole(role))

export function RoleLayout({
  role,
  children,
}: {
  role: AppRole
  children: React.ReactNode
}) {
  if (!getSupabasePublicEnv()) {
    return <ConfigNotice fullPage />
  }

  return (
    <>
      <CachedCampusShell
        profile={
          <Suspense key="profile" fallback={<ProfileSkeleton />}>
            <ProfileSlot role={role} />
          </Suspense>
        }
        navigation={
          <Suspense key="navigation" fallback={<NavSkeleton />}>
            <NavigationSlot role={role} />
          </Suspense>
        }
        header={
          <Suspense key="header" fallback={<HeaderSkeleton />}>
            <HeaderSlot role={role} />
          </Suspense>
        }
      >
        {children}
      </CachedCampusShell>
      <RoleChatDock />
    </>
  )
}

async function ProfileSlot({ role }: { role: AppRole }) {
  const profile = await loadProfile(role)
  return <ProfileBlock profile={profile} />
}

async function NavigationSlot({ role }: { role: AppRole }) {
  await loadProfile(role)
  return (
    <>
      <RoleSidebar role={role} />
      <SignOutForm />
    </>
  )
}

async function HeaderSlot({ role }: { role: AppRole }) {
  await connection()
  await loadProfile(role)
  const today = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).format(new Date())

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <MobileNav role={role} />
      <PortalSearch role={role} />
      <p className="hidden shrink-0 text-sm text-muted-foreground lg:block">{today}</p>
      <ThemeToggle />
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 pt-6 pb-4">
      <Skeleton className="size-10 rounded-2xl bg-white/10" />
      <Skeleton className="h-3 w-20 bg-white/10" />
    </div>
  )
}

function NavSkeleton() {
  return (
    <div className="space-y-2 px-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-full rounded-xl bg-white/10" />
      ))}
    </div>
  )
}

function HeaderSkeleton() {
  return <Skeleton className="h-10 w-full max-w-md rounded-2xl" />
}
