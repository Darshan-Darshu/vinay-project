import { Suspense } from "react"
import { unstable_rethrow } from "next/navigation"

import { ExamPaperListScreen } from "@/components/academics/exam-paper-screen"
import { QueryErrorState } from "@/components/dashboard/states"
import { Skeleton } from "@/components/ui/skeleton"

export const instant = false

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-[28px]" />}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  try {
    return <ExamPaperListScreen role="admin" />
  } catch (error) {
    unstable_rethrow(error)
    return <QueryErrorState />
  }
}
