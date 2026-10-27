import { cacheLife, cacheTag } from "next/cache"

import { getAdminCatalog } from "@/actions/admin/dashboard/getQueries"
import { cacheTags } from "@/actions/cache-tags"
import { CourseRow } from "@/components/dashboard/dashboard-views"
import { PromoBanner } from "@/components/dashboard/promo-banner"
import { QueryErrorState } from "@/components/dashboard/states"

export async function CachedAdminCatalog({ children }: { children: React.ReactNode }) {
  "use cache"
  cacheLife("minutes")
  cacheTag(cacheTags.courses, cacheTags.publicEvents, cacheTags.collegeSettings)

  try {
    const catalog = await getAdminCatalog()
    return (
      <div className="space-y-5">
        <PromoBanner
          title="Campus overview"
          description="Students, teachers, admissions, courses, and company visits."
          actionHref="/admin/settings"
          actionLabel="College settings"
        />
        {children}
        <CourseRow
          courses={catalog.courses}
          moreHref="/admin/courses"
          empty="Courses appear here after the college adds them."
        />
      </div>
    )
  } catch {
    return (
      <div className="space-y-5">
        <QueryErrorState />
        {children}
      </div>
    )
  }
}
