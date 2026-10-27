import type { Metadata } from "next"

import { RoleLayout } from "@/components/layout/role-layout"

export const instant = false
export const metadata: Metadata = { title: "Admin" }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="admin">{children}</RoleLayout>
}
