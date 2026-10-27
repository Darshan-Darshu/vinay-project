import { Suspense } from "react"
import type { Metadata } from "next"

import { LandingView } from "@/components/landing/landing-view"
import { Skeleton } from "@/components/ui/skeleton"
import { getCollegeSettings, type CollegeSettings } from "@/actions/college/catalog/getQueries"
import { getSupabasePublicEnv } from "@/lib/supabase/env"

export const metadata: Metadata = {
  title: "Home",
  description: "A college campus for study, gatherings, and admissions.",
}

export default function HomePage() {
  return (
    <Suspense fallback={<LandingFallback />}>
      <HomeContent />
    </Suspense>
  )
}

async function HomeContent() {
  let settings: CollegeSettings | null = null
  if (getSupabasePublicEnv()) {
    try {
      settings = await getCollegeSettings()
    } catch {
      settings = null
    }
  }

  return <LandingView settings={settings} />
}

function LandingFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-5 py-10">
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-80 w-full rounded-[28px]" />
    </div>
  )
}
