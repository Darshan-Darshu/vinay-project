import type { Metadata } from "next"

import { RoleLayout } from "@/components/layout/role-layout"

export const instant = false
export const metadata: Metadata = { title: "Student" }

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="student">{children}</RoleLayout>
}
