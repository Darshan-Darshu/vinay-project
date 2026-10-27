"use client"

import { Search } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { use } from "react"

import type { RecordFacet, RecordSearch } from "@/actions/records/types"
import { useRecordEditor } from "@/components/records/editor-context"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function RecordBrowser({
  title,
  description,
  searchParams,
  facets,
  summary,
  canCreate = false,
  children,
}: {
  title: string
  description: string
  searchParams: Promise<RecordSearch>
  facets: RecordFacet[]
  summary: React.ReactNode
  canCreate?: boolean
  children: React.ReactNode
}) {
  const params = use(searchParams)
  const pathname = usePathname()
  const query = first(params.q)
  const facet = first(params.facet)
  const editor = useRecordEditor()

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy">{title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          <div className="mt-2 min-h-5">{summary}</div>
        </div>
        {canCreate ? (
          <Button type="button" onClick={editor.openNew}>
            New
          </Button>
        ) : null}
      </header>
      <section className="rounded-[28px] bg-panel p-4">
        <form action={pathname} className="flex gap-2">
          {facet ? <input type="hidden" name="facet" value={facet} /> : null}
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search {title}</span>
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              key={query}
              name="q"
              defaultValue={query}
              placeholder="Search"
              className="h-11 w-full rounded-2xl bg-background pr-4 pl-11 text-sm outline-none ring-primary/40 placeholder:text-muted-foreground focus:ring-2"
            />
          </label>
          <button
            type="submit"
            className="h-11 shrink-0 rounded-2xl bg-navy px-4 text-sm font-medium text-white"
          >
            Search
          </button>
        </form>
        {facets.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {facets.map((item) => {
              const active = facet === item.value
              return (
                <Link
                  key={item.value || "all"}
                  href={facetHref(pathname, query, item.value)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full bg-background px-3 py-1 text-xs text-muted-foreground",
                    active && "bg-navy text-white",
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        ) : null}
      </section>
      {children}
    </div>
  )
}

export function SummaryText({ text }: { text: Promise<string> }) {
  const value = use(text)
  if (!value) return null
  return <p className="text-sm text-muted-foreground">{value}</p>
}

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value ?? "").trim()
}

function facetHref(pathname: string, query: string, facet: string) {
  const next = new URLSearchParams()
  if (query) next.set("q", query)
  if (facet) next.set("facet", facet)
  const search = next.toString()
  return search ? `${pathname}?${search}` : pathname
}
