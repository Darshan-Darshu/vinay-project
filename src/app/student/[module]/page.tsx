import { notFound } from "next/navigation"

import { studentDirectories } from "@/actions/records/directories"
import type { RecordSearch } from "@/actions/records/types"
import { PlacementCheck } from "@/components/academics/placement-check"
import { SkillMatchSection } from "@/components/academics/skill-match"
import { RecordPage } from "@/components/records/record-page"

export const instant = false

export default async function StudentModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>
  searchParams: Promise<RecordSearch>
}) {
  const { module } = await params
  const directory = studentDirectories[module]
  if (!directory) {
    notFound()
  }
  if (module === "placement") {
    return (
      <div className="space-y-6">
        <PlacementCheck />
        <SkillMatchSection />
        <RecordPage directory={directory} searchParams={searchParams} />
      </div>
    )
  }
  return <RecordPage directory={directory} searchParams={searchParams} />
}
