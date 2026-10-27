import "server-only"

import { getRoleDesk, type RoleDesk } from "@/actions/shared/role-desk"

export type { RoleDesk }

export async function getTeacherDesk(profileId: string): Promise<RoleDesk> {
  return getRoleDesk({ profileId, role: "teacher" })
}
