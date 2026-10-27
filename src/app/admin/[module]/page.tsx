import { notFound } from "next/navigation"

import { adminDirectories } from "@/actions/records/directories"
import type { RecordSearch } from "@/actions/records/types"
import { RecordPage } from "@/components/records/record-page"

export const instant = false

export default async function AdminModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>
  searchParams: Promise<RecordSearch>
}) {
  const { module } = await params
  const directory = adminDirectories[module]
  if (!directory) {
    notFound()
  }
  return <RecordPage directory={directory} searchParams={searchParams} />
}
