"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CalendarRange,
  ClipboardList,
  FileQuestion,
  FileText,
  FolderOpen,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Library,
  Megaphone,
  MessagesSquare,
  NotebookPen,
  ScrollText,
  Settings,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react"

import { navForRole } from "@/constants/navigation"
import { cn } from "@/lib/utils"
import type { AppRole } from "@/lib/permissions/roles"

const icons: Record<string, LucideIcon> = {
  admissions: ClipboardList,
  students: Users,
  teachers: GraduationCap,
  departments: Building2,
  courses: BookOpen,
  subjects: Library,
  questions: FileQuestion,
  papers: ScrollText,
  "exam-papers": FileText,
  materials: FolderOpen,
  tests: ClipboardList,
  interview: MessagesSquare,
  "exam-marks": NotebookPen,
  "academic-years": CalendarRange,
  semesters: Layers,
  announcements: Megaphone,
  events: Calendar,
  sports: Trophy,
  placements: Briefcase,
  placement: Briefcase,
  settings: Settings,
  profile: UserRound,
}

export function RoleSidebar({
  role,
  onNavigate,
}: {
  role: AppRole
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const items = navForRole(role)

  return (
    <nav
      aria-label="Portal"
      className="flex flex-1 flex-col gap-1 overflow-y-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const active =
          item.href === `/${role}`
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
        const key = item.href.split("/").pop() ?? ""
        const Icon = item.href === `/${role}` ? LayoutDashboard : (icons[key] ?? FolderOpen)

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "mx-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/75 hover:bg-white/10 hover:text-white",
              active && "bg-white font-medium text-[#1c2434] hover:bg-white hover:text-[#1c2434]",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
