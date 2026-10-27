import { Suspense } from "react"
import { unstable_rethrow } from "next/navigation"

import { readSearch } from "@/actions/records/shared"
import type { Directory, RecordSearch } from "@/actions/records/types"
import { QueryErrorState } from "@/components/dashboard/states"
import { RecordBrowser, SummaryText } from "@/components/records/record-browser"
import { RecordEditorFrame } from "@/components/records/record-editor"
import { RecordList, RecordSkeleton } from "@/components/records/record-list"

export function RecordPage({
  directory,
  searchParams,
}: {
  directory: Directory
  searchParams: Promise<RecordSearch>
}) {
  return (
    <Suspense fallback={<RecordSkeleton />}>
      <RecordScreen directory={directory} searchParams={searchParams} />
    </Suspense>
  )
}

function RecordScreen({
  directory,
  searchParams,
}: {
  directory: Directory
  searchParams: Promise<RecordSearch>
}) {
  const screen = (
    <RecordBrowser
      title={directory.title}
      description={directory.description}
      searchParams={searchParams}
      facets={directory.facets ?? []}
      canCreate={Boolean(directory.editor) && directory.canCreate !== false}
      summary={
        <Suspense fallback={null}>
          <RecordSummary directory={directory} searchParams={searchParams} />
        </Suspense>
      }
    >
      <Suspense fallback={<RecordSkeleton />}>
        <RecordResults
          directory={directory}
          searchParams={searchParams}
          selectable={Boolean(directory.editor)}
        />
      </Suspense>
    </RecordBrowser>
  )

  if (!directory.editor) return screen
  return (
    <RecordEditorFrame kind={directory.editor} noun={directory.noun}>
      {screen}
    </RecordEditorFrame>
  )
}

async function RecordSummary({
  directory,
  searchParams,
}: {
  directory: Directory
  searchParams: Promise<RecordSearch>
}) {
  const { query, facet } = readSearch(await searchParams)
  const text = directory.load(query, facet).then(
    (cards) => describeCards(cards.length, directory.noun),
    () => "",
  )
  return <SummaryText text={text} />
}

async function RecordResults({
  directory,
  searchParams,
  selectable,
}: {
  directory: Directory
  searchParams: Promise<RecordSearch>
  selectable: boolean
}) {
  const { query, facet } = readSearch(await searchParams)
  let cards
  try {
    cards = await directory.load(query, facet)
  } catch (error) {
    unstable_rethrow(error)
    cards = null
  }
  if (!cards) return <QueryErrorState />
  return <RecordList cards={cards} empty={directory.empty} selectable={selectable} />
}

function describeCards(count: number, noun: string) {
  const label = count === 1 ? noun : noun === "company" ? "companies" : `${noun}s`
  if (count === 0) return `No ${label} match.`
  return `${count} ${label}`
}
