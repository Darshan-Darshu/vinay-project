import Link from "next/link";

import { EmptyState } from "@/components/dashboard/states";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminOffice } from "@/actions/admin/dashboard/getQueries";
import type { CourseItem, PublicEvent } from "@/actions/college/catalog/getQueries";
import type { RoleDesk } from "@/actions/shared/role-desk";

const barColors = [
  "bg-[#f3a8cb]",
  "bg-[#6fce86]",
  "bg-[#7eb6f6]",
  "bg-[#b9a7f5]",
  "bg-[#f0d56a]",
];
const courseStyles = [
  { wrap: "bg-[#e7f0ff]", blob: "bg-[#9ec0f3]" },
  { wrap: "bg-[#e7f6ee]", blob: "bg-[#7dce8a]" },
  { wrap: "bg-[#fff6d8]", blob: "bg-[#f0d56a]" },
];

export function AdminOfficeView({ office }: { office: AdminOffice }) {
  const rows = [
    { label: "Students", value: office.students },
    { label: "Teachers", value: office.teachers },
    { label: "Departments", value: office.departments },
    { label: "New admissions", value: office.newAdmissions },
    { label: "Open companies", value: office.openDrives },
    { label: "Placement applications", value: office.pendingApplications },
    { label: "Active courses", value: office.activeCourses },
  ];
  const peak = Math.max(...rows.map((row) => row.value), 1);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[28px] bg-panel p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">College totals</h2>
            <Link
              href="/admin/students"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              More →
            </Link>
          </div>
          <ul className="space-y-3">
            {rows.map((row, index) => (
              <li
                key={row.label}
                className="grid grid-cols-[minmax(0,1fr)_5.5rem_2rem] items-center gap-3 text-sm"
              >
                <span className="truncate">{row.label}</span>
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-white">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      barColors[index % barColors.length],
                    )}
                    style={{
                      width: `${Math.max(8, Math.round((row.value / peak) * 100))}%`,
                    }}
                  />
                </span>
                <span className="w-8 text-right text-xs text-muted-foreground">
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-[28px] bg-panel p-5">
          <h2 className="mb-4 text-sm font-semibold">Recent activity</h2>
          {office.recentActivity.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Updates such as college settings changes will appear here."
            />
          ) : (
            <ul className="space-y-3">
              {office.recentActivity.map((item) => (
                <li key={item.id} className="text-sm">
                  <p>{item.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(item.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="rounded-[28px] bg-panel p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Office work</h2>
          <span className="text-xs text-muted-foreground">{office.readiness}% ready</span>
        </div>
        <ul className="space-y-3">
          {office.tasks.map((task) => (
            <li key={task.id}>
              <Link href={task.href} className="text-sm font-medium hover:underline">
                {task.title}
              </Link>
              <p className="text-xs text-muted-foreground">{task.detail}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function DeskFocus({ desk }: { desk: RoleDesk }) {
  return (
    <section className="rounded-[28px] bg-panel p-5">
      <h2 className="text-sm font-semibold">{desk.headline}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{desk.summary}</p>
      <p className="mt-2 text-xs text-muted-foreground">{desk.termLabel}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {desk.focus.map((item) => (
          <li key={item.title} className="rounded-2xl bg-white px-3 py-3">
            <p className="text-xs text-muted-foreground">{item.title}</p>
            <p className="text-sm font-medium">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CourseRow({
  courses,
  moreHref,
  empty,
}: {
  courses: CourseItem[];
  moreHref: string;
  empty: string;
}) {
  const visible = courses.slice(0, 3);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Active courses</h2>
        <Link
          href={moreHref}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          More →
        </Link>
      </div>
      {visible.length === 0 ? (
        <EmptyState title="No courses yet" description={empty} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-3">
          {visible.map((course, index) => {
            const style = courseStyles[index % courseStyles.length];
            return (
              <li key={course.id}>
                <Link
                  href={moreHref}
                  className={cn(
                    "flex items-center gap-3 rounded-[24px] px-3 py-3",
                    style.wrap,
                  )}
                >
                  <span
                    className={cn("size-12 shrink-0 rounded-2xl", style.blob)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {course.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {course.departmentName}
                    </span>
                  </span>
                  <span className="ml-auto text-muted-foreground">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function EventList({
  events,
  empty,
}: {
  events: PublicEvent[];
  empty: string;
}) {
  if (events.length === 0) {
    return <EmptyState title="Nothing scheduled" description={empty} />;
  }

  return (
    <ul className="divide-y divide-[#e7edf5] overflow-hidden rounded-[28px] bg-panel">
      {events.map((event) => (
        <li key={event.id} className="px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium">{event.title}</h3>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(event.startsAt)}
            </p>
          </div>
          {event.eventType ? (
            <p className="text-xs text-muted-foreground capitalize">
              {event.eventType}
            </p>
          ) : null}
          {event.venue ? <p className="text-sm">{event.venue}</p> : null}
          {event.description ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {event.description}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
