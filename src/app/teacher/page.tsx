import { Suspense } from "react"
import { unstable_rethrow } from "next/navigation"

import { getTeacherDesk } from "@/actions/teacher/dashboard/getQueries"
import { DeskFocus } from "@/components/dashboard/dashboard-views"
import { QueryErrorState } from "@/components/dashboard/states"
import { Skeleton } from "@/components/ui/skeleton"
import { requireRole } from "@/lib/auth/session"

export const instant = false

export default function TeacherPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-[28px]" />}>
      <TeacherDesk />
    </Suspense>
  )
}

async function TeacherDesk() {
  try {
    const profile = await requireRole("teacher")
    const desk = await getTeacherDesk(profile.id)
    return (
      <div className="space-y-5">
        <DeskFocus desk={desk} />
      </div>
    )
  } catch (error) {
    unstable_rethrow(error)
    return <QueryErrorState />
  }
}
