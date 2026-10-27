import { notFound } from "next/navigation"

import { teacherDirectories } from "@/actions/records/directories"
import type { RecordSearch } from "@/actions/records/types"
import { RecordPage } from "@/components/records/record-page"

export const instant = false

export default async function TeacherModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>
  searchParams: Promise<RecordSearch>
}) {
  const { module } = await params
  const directory = teacherDirectories[module]
  if (!directory) {
    notFound()
  }
  return <RecordPage directory={directory} searchParams={searchParams} />
}
