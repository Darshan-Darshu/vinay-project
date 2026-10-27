import Link from "next/link"

import { signOut } from "@/actions/auth/updateQueries"
import type { Profile } from "@/lib/permissions/roles"

export function ProfileBlock({ profile }: { profile: Profile }) {
  const handle = profile.email.split("@")[0] ?? profile.role

  return (
    <Link href={`/${profile.role}/profile`} className="flex items-center gap-3 px-4 pt-6 pb-4">
      {safeAvatar(profile.avatarUrl) ? (
        <span
          aria-hidden
          className="size-10 shrink-0 rounded-2xl bg-cover bg-center"
          style={{ backgroundImage: `url("${safeAvatar(profile.avatarUrl)}")` }}
        />
      ) : (
        <Avatar name={profile.fullName} />
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{profile.fullName}</span>
        <span className="mt-0.5 block truncate text-xs text-white/55">@{handle}</span>
      </span>
    </Link>
  )
}

export function SignOutForm() {
  return (
    <form action={signOut} className="p-3">
      <button
        type="submit"
        className="w-full rounded-xl px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10 hover:text-white"
      >
        Sign out
      </button>
    </form>
  )
}

function safeAvatar(url: string | null) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
    return parsed.href.replace(/"/g, "")
  } catch {
    return null
  }
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold">
      {initials || "?"}
    </span>
  )
}
