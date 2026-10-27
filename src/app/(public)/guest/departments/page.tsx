import { Suspense } from "react"
import type { Metadata } from "next"

import { ConfigNotice } from "@/components/dashboard/config-notice"
import { Loaded } from "@/components/dashboard/loaded"
import { PageHeader } from "@/components/dashboard/stat-card"
import { EmptyState } from "@/components/dashboard/states"
import { listDepartments } from "@/actions/college/catalog/getQueries"
import { getSupabasePublicEnv } from "@/lib/supabase/env"

export const metadata: Metadata = { title: "Departments" }

export default function DepartmentsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading departments…</p>}>
      <DepartmentsContent />
    </Suspense>
  )
}

async function DepartmentsContent() {
  if (!getSupabasePublicEnv()) return <ConfigNotice />
  return (
    <Loaded loader={listDepartments}>
      {(departments) => (
        <div>
          <PageHeader title="Departments" description="Active departments at the college." />
          {departments.length === 0 ? (
            <EmptyState
              title="No departments yet"
              description="Departments will appear here after the college adds them."
            />
          ) : (
            <ul className="divide-y divide-[#e7edf5] overflow-hidden rounded-[28px] bg-panel">
              {departments.map((department) => (
                <li key={department.id} className="px-4 py-3">
                  <h2 className="text-sm font-medium">
                    {department.name}{" "}
                    <span className="text-muted-foreground">({department.code})</span>
                  </h2>
                  {department.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{department.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Loaded>
  )
}
