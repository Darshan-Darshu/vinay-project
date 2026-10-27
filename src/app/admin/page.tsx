import { Suspense } from "react"
import { unstable_rethrow } from "next/navigation"

import { getAdminOffice } from "@/actions/admin/dashboard/getQueries"
import { CachedAdminCatalog } from "@/components/dashboard/cached-admin-catalog"
import { AdminOfficeView } from "@/components/dashboard/dashboard-views"
import { QueryErrorState } from "@/components/dashboard/states"
import { Skeleton } from "@/components/ui/skeleton"

export const instant = false

export default function AdminPage() {
  return (
    <CachedAdminCatalog>
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-[28px]" />}>
        <AdminOfficePanel />
      </Suspense>
    </CachedAdminCatalog>
  )
}

async function AdminOfficePanel() {
  try {
    const office = await getAdminOffice()
    return <AdminOfficeView office={office} />
  } catch (error) {
    unstable_rethrow(error)
    return <QueryErrorState />
  }
}
