import { Suspense } from "react"
import type { Metadata } from "next"

import { ConfigNotice } from "@/components/dashboard/config-notice"
import { EventList } from "@/components/dashboard/dashboard-views"
import { Loaded } from "@/components/dashboard/loaded"
import { PageHeader } from "@/components/dashboard/stat-card"
import { listPublicEvents } from "@/actions/college/catalog/getQueries"
import { getSupabasePublicEnv } from "@/lib/supabase/env"

export const metadata: Metadata = { title: "Events" }

export default function EventsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading events…</p>}>
      <EventsContent />
    </Suspense>
  )
}

async function EventsContent() {
  if (!getSupabasePublicEnv()) return <ConfigNotice />
  return (
    <Loaded loader={listPublicEvents}>
      {(events) => (
        <div>
          <PageHeader
            title="Events"
            description="Events the college has published for visitors."
          />
          <EventList events={events} empty="No public events are scheduled." />
        </div>
      )}
    </Loaded>
  )
}
