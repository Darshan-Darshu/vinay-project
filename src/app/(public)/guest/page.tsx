import { Suspense } from "react"
import type { Metadata } from "next"
import Link from "next/link"

import { ConfigNotice } from "@/components/dashboard/config-notice"
import { Loaded } from "@/components/dashboard/loaded"
import { PageHeader } from "@/components/dashboard/stat-card"
import { Button } from "@/components/ui/button"
import { getCollegeSettings } from "@/actions/college/catalog/getQueries"
import { getSupabasePublicEnv } from "@/lib/supabase/env"

export const metadata: Metadata = { title: "Campus guide" }

export default function GuestPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <GuestContent />
    </Suspense>
  )
}

async function GuestContent() {
  if (!getSupabasePublicEnv()) return <ConfigNotice />

  return (
    <Loaded loader={getCollegeSettings}>
      {(settings) => (
        <div>
          <PageHeader
            title="Campus guide"
            description={settings?.about || "Public college information."}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["/guest/departments", "Departments"],
              ["/guest/courses", "Courses"],
              ["/guest/admissions", "Admissions"],
              ["/guest/events", "Events"],
              ["/guest/documents", "Upload a PDF"],
            ].map(([href, label]) => (
              <Button key={href} variant="ghost" asChild className="h-auto justify-between rounded-[24px] bg-panel px-4 py-5">
                <Link href={href}>
                  {label}
                  <span aria-hidden>›</span>
                </Link>
              </Button>
            ))}
          </div>
        </div>
      )}
    </Loaded>
  )
}
