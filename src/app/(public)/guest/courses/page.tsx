import { Suspense } from "react"
import type { Metadata } from "next"

import { ConfigNotice } from "@/components/dashboard/config-notice"
import { Loaded } from "@/components/dashboard/loaded"
import { PageHeader } from "@/components/dashboard/stat-card"
import { EmptyState } from "@/components/dashboard/states"
import { listCourses } from "@/actions/college/catalog/getQueries"
import { getSupabasePublicEnv } from "@/lib/supabase/env"

export const metadata: Metadata = { title: "Courses" }

export default function CoursesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading courses…</p>}>
      <CoursesContent />
    </Suspense>
  )
}

async function CoursesContent() {
  if (!getSupabasePublicEnv()) return <ConfigNotice />
  return (
    <Loaded loader={listCourses}>
      {(courses) => (
        <div>
          <PageHeader title="Courses" description="Active courses and their departments." />
          {courses.length === 0 ? (
            <EmptyState
              title="No courses yet"
              description="Courses will appear here after the college adds them."
            />
          ) : (
            <ul className="divide-y divide-[#e7edf5] overflow-hidden rounded-[28px] bg-panel">
              {courses.map((course) => (
                <li key={course.id} className="px-4 py-3">
                  <h2 className="text-sm font-medium">
                    {course.name}{" "}
                    <span className="text-muted-foreground">({course.code})</span>
                  </h2>
                  <p className="text-xs text-muted-foreground">{course.departmentName}</p>
                  {course.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{course.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Loaded>
  )
}
