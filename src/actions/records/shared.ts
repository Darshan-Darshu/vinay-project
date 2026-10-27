import "server-only"

import { connection } from "next/server"
import { cache } from "react"

import type { RecordCard, RecordSearch, RecordTone } from "@/actions/records/types"
import { QueryError, isRecord } from "@/lib/db/errors"
import { createClient } from "@/lib/supabase/server"

export const campusDb = cache(async () => {
  await connection()
  return createClient()
})

export function readSearch(params: RecordSearch) {
  return {
    query: firstParam(params.q),
    facet: firstParam(params.facet),
  }
}

export function matchesQuery(card: RecordCard, query: string) {
  if (!query) return true
  const haystack = [card.title, card.subtitle, card.detail, card.meta, card.badge]
    .join(" ")
    .toLowerCase()
  return haystack.includes(query.toLowerCase())
}

export function readRows<T>(
  data: unknown,
  error: { message: string } | null,
  guard: (value: unknown) => value is T,
): T[] {
  if (error || !Array.isArray(data) || !data.every(guard)) {
    throw new QueryError()
  }
  return data
}

export function relatedText(value: unknown, key: string): string {
  if (Array.isArray(value)) return relatedText(value[0], key)
  if (!isRecord(value)) return ""
  const field = value[key]
  if (typeof field === "string") return field
  if (typeof field === "number") return String(field)
  return ""
}

export function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    applied: "Applied",
    under_review: "In review",
    approved: "Approved",
    rejected: "Rejected",
    completed: "Enrolled",
    draft: "Draft",
    published: "Published",
    cancelled: "Cancelled",
    everyone: "Everyone",
    students: "Students",
    teachers: "Teachers",
    admins: "Admins",
    low: "Low",
    normal: "Normal",
    high: "High",
    open: "Open",
    closed: "Closed",
    full_time: "Full time",
    internship: "Internship",
    shortlisted: "Shortlisted",
    selected: "Selected",
    not_selected: "Not selected",
    active: "Active",
    inactive: "Inactive",
    current: "Current",
  }
  if (labels[value]) return labels[value]
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function toneFor(status: string): RecordTone {
  if (["approved", "completed", "published", "active", "current", "open", "selected"].includes(status)) {
    return "good"
  }
  if (["rejected", "cancelled", "high", "inactive", "not_selected"].includes(status)) return "alert"
  if (["under_review", "draft", "shortlisted"].includes(status)) return "wait"
  if (["applied", "low", "closed"].includes(status)) return "info"
  return "neutral"
}

export function activityMatch(isActive: boolean, facet: string) {
  if (facet === "active") return isActive
  if (facet === "inactive") return !isActive
  return true
}

function firstParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  return (raw ?? "").trim().slice(0, 80)
}
