import { Bell } from "lucide-react"

import type { PublicEvent } from "@/actions/college/catalog/getQueries"

export function EventsRail({ events }: { events: PublicEvent[] }) {
  const upcoming = events.slice(0, 4)

  return (
    <div className="flex h-full flex-col px-5 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-navy">Active events</h2>
        <Bell className="size-4 text-muted-foreground" />
      </div>
      {upcoming.length === 0 ? (
        <div className="rounded-3xl bg-panel px-4 py-8 text-center text-sm text-muted-foreground">
          No public events are coming up.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {upcoming.map((event) => {
            const when = new Date(event.startsAt)
            const weekday = Number.isNaN(when.getTime())
              ? ""
              : when.toLocaleDateString("en-GB", { weekday: "short" })
            const day = Number.isNaN(when.getTime())
              ? "—"
              : when.toLocaleDateString("en-GB", { day: "2-digit" })
            const time = Number.isNaN(when.getTime())
              ? event.startsAt
              : when.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })

            return (
              <li key={event.id} className="rounded-3xl bg-panel px-4 py-5 text-center">
                <p className="text-xs text-muted-foreground">{weekday}</p>
                <p className="text-3xl font-semibold tracking-tight text-navy">{day}</p>
                <p className="mt-2 line-clamp-2 text-sm font-medium">{event.title}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {time}
                  {event.venue ? ` · ${event.venue}` : ""}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
