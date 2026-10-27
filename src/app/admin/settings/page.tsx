import { Suspense } from "react"

import { QueryErrorState } from "@/components/dashboard/states"
import { PageHeader } from "@/components/dashboard/stat-card"
import { CollegeSettingsForm } from "@/components/forms/account-forms"
import { getCollegeSettings } from "@/actions/admin/settings/getQueries"

export const instant = false

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading settings…</p>}>
      <SettingsContent />
    </Suspense>
  )
}

async function SettingsContent() {
  let settings: Awaited<ReturnType<typeof getCollegeSettings>> = null
  let failed = false
  try {
    settings = await getCollegeSettings()
  } catch {
    failed = true
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="This text is what guests see on the public college pages."
      />
      {failed || !settings ? <QueryErrorState /> : <CollegeSettingsForm settings={settings} />}
    </div>
  )
}
