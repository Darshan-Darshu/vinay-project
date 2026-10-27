import { Suspense } from "react"
import type { Metadata } from "next"

import { ConfigNotice } from "@/components/dashboard/config-notice"
import { Loaded } from "@/components/dashboard/loaded"
import { PageHeader } from "@/components/dashboard/stat-card"
import { getCollegeSettings } from "@/actions/college/catalog/getQueries"
import { getSupabasePublicEnv } from "@/lib/supabase/env"

export const metadata: Metadata = { title: "Admissions" }

export default function AdmissionsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading admissions…</p>}>
      <AdmissionsContent />
    </Suspense>
  )
}

async function AdmissionsContent() {
  if (!getSupabasePublicEnv()) return <ConfigNotice />
  return (
    <Loaded loader={getCollegeSettings}>
      {(settings) => (
        <div>
          <PageHeader
            title="Admissions"
            description="Information published by the college. Applications are handled by the office."
          />
          <div className="max-w-2xl rounded-[28px] bg-panel px-5 py-4 whitespace-pre-wrap text-sm leading-6">
            {settings?.admissionsInfo || "Admissions information has not been published yet."}
          </div>
        </div>
      )}
    </Loaded>
  )
}
