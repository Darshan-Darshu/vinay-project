import { Suspense } from "react"
import { unstable_rethrow } from "next/navigation"

import { TestDetailScreen } from "@/components/academics/screens"
import { QueryErrorState } from "@/components/dashboard/states"
import { Skeleton } from "@/components/ui/skeleton"

export const instant = false

export default function Page({ params }: { params: Promise<{ paperId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full rounded-[28px]" />}>
      <Screen params={params} />
    </Suspense>
  )
}

async function Screen({ params }: { params: Promise<{ paperId: string }> }) {
  try {
    const { paperId } = await params
    return <TestDetailScreen paperId={paperId} />
  } catch (error) {
    unstable_rethrow(error)
    return <QueryErrorState />
  }
}
