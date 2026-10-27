"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { loadEditor } from "@/actions/admin/records/load"
import type { EditorOptions, EditorRecord } from "@/actions/admin/records/types"
import type { EditorKind } from "@/actions/records/types"
import { EditorForm } from "@/components/records/editor-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { EditorContext } from "@/components/records/editor-context"

function editorKey(kind: EditorKind, recordId: string | null, record: EditorRecord | null) {
  const status = record && "status" in record.values ? record.values.status : "form"
  const applicants =
    record?.kind === "placement" ? record.values.applicants.map((applicant) => applicant.status).join(",") : ""
  return `${kind}-${record?.kind === kind ? recordId : "new"}-${status}-${applicants}`
}

const blurbs: Record<EditorKind, string> = {
  department: "Name and code are unique across the college.",
  course: "A course belongs to one department.",
  subject: "A subject belongs to one department and one course in that department.",
  "academic-year": "Only one year can be current.",
  semester: "A semester ties a course to an academic year.",
  teacher: "Creating a teacher also creates their sign-in.",
  student: "Roll number, course placement, and whether the student can sign in.",
  admission: "The office files this for the student or parent. New applications start as applied.",
  announcement: "Drafts stay off the campus boards until you publish them.",
  event: "Placement visits and sports fixtures have their own screens.",
  sports: "A fixture or notice on the campus calendar.",
  placement: "Post a company visit, then open it so eligible students can apply.",
}

export function RecordEditorFrame({
  kind,
  noun,
  children,
}: {
  kind: EditorKind
  noun: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const request = useRef(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [recordId, setRecordId] = useState<string | null>(null)
  const [record, setRecord] = useState<EditorRecord | null>(null)
  const [options, setOptions] = useState<EditorOptions | null>(null)

  const openWith = useCallback(
    async (id: string | null, mode: "open" | "reload" = "open") => {
      const token = ++request.current
      if (mode === "open") {
        setOpen(true)
        setSaved(null)
        setNotice(null)
        setLoadError(null)
        setRecord(null)
        setOptions(null)
        setLoading(true)
      }
      setRecordId(id)
      const result = await loadEditor(kind, id)
      if (token !== request.current) return
      if (mode === "open") setLoading(false)
      if (result.error || !result.options) {
        setRecord(null)
        setOptions(null)
        setLoadError(result.error ?? "That record could not be opened.")
        return
      }
      setLoadError(null)
      setRecord(result.record)
      setOptions(result.options)
    },
    [kind],
  )

  const onComplete = useCallback(
    (message: string, created: boolean, reload: boolean) => {
      router.refresh()
      if (created) {
        setSaved(message)
        setRecord(null)
        return
      }
      if (reload && recordId) {
        setNotice(message)
        void openWith(recordId, "reload")
      }
    },
    [openWith, recordId, router],
  )

  const close = useCallback((next: boolean) => {
    setOpen(next)
    if (!next) {
      request.current += 1
      setSaved(null)
      setNotice(null)
      setLoadError(null)
    }
  }, [])

  return (
    <EditorContext.Provider
      value={{
        editable: true,
        openNew: () => void openWith(null),
        openId: (id) => void openWith(id),
      }}
    >
      {children}
      <Sheet open={open} onOpenChange={close}>
        <SheetContent className={kind === "placement" ? "w-full sm:max-w-lg" : "w-full sm:max-w-md"}>
          <SheetHeader className="pr-10">
            <SheetTitle>{recordId ? `Edit ${noun}` : `New ${noun}`}</SheetTitle>
            <SheetDescription>{blurbs[kind]}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            {notice ? (
              <Alert className="mb-4">
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            ) : null}
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
            {loadError ? (
              <Alert variant="destructive">
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            ) : null}
            {saved ? (
              <Alert>
                <AlertDescription>{saved}</AlertDescription>
              </Alert>
            ) : null}
            {!loading && !loadError && !saved && options ? (
              <EditorForm
                key={editorKey(kind, recordId, record)}
                kind={kind}
                record={record}
                options={options}
                onComplete={onComplete}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </EditorContext.Provider>
  )
}
