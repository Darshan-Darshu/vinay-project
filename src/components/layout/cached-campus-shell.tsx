import { cacheLife, cacheTag } from "next/cache"

import { cacheTags } from "@/actions/cache-tags"
import { getCollegeSettings, listPublicEvents, type PublicEvent } from "@/actions/college/catalog/getQueries"
import { EventsRail } from "@/components/layout/events-rail"

export async function CachedCampusShell({
  profile,
  navigation,
  header,
  children,
}: {
  profile: React.ReactNode
  navigation: React.ReactNode
  header: React.ReactNode
  children: React.ReactNode
}) {
  "use cache"
  cacheLife("minutes")
  cacheTag(cacheTags.collegeSettings, cacheTags.publicEvents)

  let collegeName = "College"
  let events: PublicEvent[] = []
  try {
    const settings = await getCollegeSettings()
    if (settings?.name) collegeName = settings.name
    events = await listPublicEvents()
  } catch {
    collegeName = "College"
    events = []
  }

  return (
    <div className="portal-light flex min-h-screen bg-white">
      <aside className="hidden w-[220px] shrink-0 print:hidden md:block">
        <div className="sticky top-0 flex h-screen flex-col bg-[#101a2c] text-white">
          {profile}
          <p className="px-4 pb-3 text-xs text-white/40">{collegeName}</p>
          <div className="flex min-h-0 flex-1 flex-col">{navigation}</div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col md:flex-row">
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 px-4 pt-5 pb-2 print:hidden sm:px-6">{header}</header>
          <main id="main" className="flex-1 px-4 py-4 sm:px-6 sm:py-5">
            {children}
          </main>
        </div>
        <aside className="w-full shrink-0 border-t border-[#eef2f7] print:hidden md:w-[280px] md:border-t-0 md:border-l">
          <EventsRail events={events} />
        </aside>
      </div>
    </div>
  )
}
