"use client"

import { Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

import { navForRole } from "@/constants/navigation"
import type { AppRole } from "@/lib/permissions/roles"

export function PortalSearch({ role }: { role: AppRole }) {
  const router = useRouter()
  const items = navForRole(role)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    return items.filter((item) => item.label.toLowerCase().includes(needle)).slice(0, 6)
  }, [items, query])

  return (
    <div className="relative min-w-0 flex-1">
      <label className="relative block">
        <span className="sr-only">Search the portal</span>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && matches[0]) {
              router.push(matches[0].href)
              setQuery("")
              setOpen(false)
            }
          }}
          placeholder="Search"
          className="h-12 w-full rounded-2xl bg-panel pr-4 pl-11 text-sm outline-none ring-primary/30 placeholder:text-muted-foreground focus:ring-2"
        />
      </label>
      {open && query.trim() ? (
        <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl bg-white p-1 shadow-lg ring-1 ring-black/5">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No matching pages</li>
          ) : (
            matches.map((item) => (
              <li key={item.href}>
                <button
                  type="button"
                  className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-panel"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    router.push(item.href)
                    setQuery("")
                    setOpen(false)
                  }}
                >
                  {item.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
