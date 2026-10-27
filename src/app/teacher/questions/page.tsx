import { Suspense } from "react"
import { unstable_rethrow } from "next/navigation"

import { QuestionScreen } from "@/components/academics/screens"
import { QueryErrorState } from "@/components/dashboard/states"
import { Skeleton } from "@/components/ui/skeleton"

export const instant = false

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ question?: string }>
}) {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-[28px]" />}>
      <Screen searchParams={searchParams} />
    </Suspense>
  )
}

async function Screen({ searchParams }: { searchParams: Promise<{ question?: string }> }) {
  try {
    const params = await searchParams
    return <QuestionScreen role="teacher" questionId={params.question} />
  } catch (error) {
    unstable_rethrow(error)
    return <QueryErrorState />
  }
}
