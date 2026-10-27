import type { Metadata } from "next"

import { RoleLayout } from "@/components/layout/role-layout"

export const instant = false
export const metadata: Metadata = { title: "Teacher" }

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <RoleLayout role="teacher">{children}</RoleLayout>
}
