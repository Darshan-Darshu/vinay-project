export const appRoles = ["admin", "teacher", "student"] as const

export type AppRole = (typeof appRoles)[number]

export type Profile = {
  id: string
  role: AppRole
  fullName: string
  email: string
  phone: string | null
  avatarUrl: string | null
  isActive: boolean
}

export function isAppRole(value: unknown): value is AppRole {
  return value === "admin" || value === "teacher" || value === "student"
}

export function homeForRole(role: AppRole): string {
  switch (role) {
    case "admin":
      return "/admin"
    case "teacher":
      return "/teacher"
    case "student":
      return "/student"
  }
}

export function safeNextPath(role: AppRole, nextPath: string | null): string {
  const home = homeForRole(role)
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return home
  }
  if (nextPath === home || nextPath.startsWith(`${home}/`)) {
    return nextPath
  }
  return home
}
