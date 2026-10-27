"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"

import { loadAdmissionFormOptions, type AdmissionFormOptions } from "@/actions/ai/admission-form-options"
import { cancelAdminProposal, confirmAdminProposal } from "@/actions/ai/admin-proposals"
import type { ChatWidget } from "@/lib/ai/chat-widgets"

const inputClass = "mt-1 w-full rounded-xl border border-[#ddd4c6] bg-white px-3 py-2 text-[#2b2433] disabled:opacity-60"

export function ChatWidgets({
  widgets,
  onAsk,
  onSettled,
}: {
  widgets: ChatWidget[]
  onAsk: (message: string) => void
  onSettled: (proposalId: string, result: string) => void
}) {
  if (widgets.length === 0) return null
  return (
    <div className="mt-2 flex w-full max-w-xl flex-col gap-2">
      {widgets.map((widget, index) => {
        if (widget.kind === "list") return <AdmissionList key={`list-${index}`} widget={widget} onAsk={onAsk} />
        if (widget.kind === "detail") return <AdmissionDetail key={`detail-${index}`} widget={widget} />
        return <AdmissionForm key={widget.proposalId} widget={widget} onSettled={onSettled} />
      })}
    </div>
  )
}

function AdmissionList({ widget, onAsk }: { widget: Extract<ChatWidget, { kind: "list" }>; onAsk: (message: string) => void }) {
  return (
    <section className="rounded-2xl bg-[#f6f1e6] px-4 py-3 text-sm text-[#2b2433]">
      <p className="text-xs font-medium tracking-wide text-[#6d5c4a]">Admissions</p>
      {widget.rows.length === 0 ? <p className="mt-2">No admissions match.</p> : null}
      <ul className="mt-2 space-y-2">
        {widget.rows.map((row) => {
          const who = row.email || row.fullName
          return (
            <li key={row.id || who} className="flex items-start justify-between gap-3 border-t border-[#e4d9c8] pt-2 first:border-t-0 first:pt-0">
              <div>
                <p className="font-medium">{row.fullName || row.email}</p>
                <p className="text-[#5c5348]">{[row.email, label(row.status), row.departmentCode, row.courseCode].filter(Boolean).join(" · ")}</p>
              </div>
              {who ? (
                <button
                  type="button"
                  className="shrink-0 rounded-full bg-[#2a2436] px-3 py-1.5 text-[#f6f1e6]"
                  onClick={() => onAsk(`Show the admission for ${who}`)}
                >
                  Open
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
      {widget.total > widget.rows.length ? (
        <p className="mt-2 text-xs text-[#6d5c4a]">Showing {widget.rows.length} of {widget.total}.</p>
      ) : null}
    </section>
  )
}

function AdmissionDetail({ widget }: { widget: Extract<ChatWidget, { kind: "detail" }> }) {
  const row = widget.row
  const lines = [
    ["Email", row.email],
    ["Phone", row.phone || "Not set"],
    ["Status", label(row.status) || "Not set"],
    ["Department", row.departmentCode || "Not set"],
    ["Course", row.courseCode || "Not set"],
    ["Semester", row.semesterNumber ? `Semester ${row.semesterNumber}` : "Not set"],
    ["Notes", row.notes || "None"],
  ]
  return (
    <section className="rounded-2xl bg-[#f6f1e6] px-4 py-3 text-sm text-[#2b2433]">
      <p className="text-xs font-medium tracking-wide text-[#6d5c4a]">Admission</p>
      <p className="mt-1 font-medium">{row.fullName || row.email}</p>
      <dl className="mt-2 space-y-1">
        {lines.map(([name, value]) => (
          <div key={name} className="grid grid-cols-[7rem_1fr] gap-2">
            <dt className="text-[#6d5c4a]">{name}</dt>
            <dd className="whitespace-pre-wrap">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function AdmissionForm({
  widget,
  onSettled,
}: {
  widget: Extract<ChatWidget, { kind: "form" }>
  onSettled?: (proposalId: string, result: string) => void
}) {
  const [options, setOptions] = useState<AdmissionFormOptions | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [values, setValues] = useState(() => initialValues(widget))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState(widget.result ?? "")
  const settled = result.length > 0
  const courses = (options?.courses ?? []).filter((course) => course.departmentId === values.departmentId)
  const semesters = (options?.semesters ?? []).filter((semester) => semester.courseId === values.courseId)

  useEffect(() => {
    if (widget.mode === "status" || widget.mode === "enroll") return
    let active = true
    void loadAdmissionFormOptions()
      .then((loaded) => {
        if (!active) return
        if (!loaded) setOptionsError("The form options could not be loaded.")
        else setOptions(loaded)
      })
      .catch(() => {
        if (active) setOptionsError("The form options could not be loaded.")
      })
    return () => {
      active = false
    }
  }, [widget.mode])

  function setField(key: string, value: string) {
    setValues((current) => {
      const next = { ...current, [key]: value }
      if (key === "departmentId") {
        const stillThere = (options?.courses ?? []).some((course) => course.id === current.courseId && course.departmentId === value)
        if (!stillThere) {
          next.courseId = ""
          next.semesterId = ""
        }
      }
      if (key === "courseId") next.semesterId = ""
      return next
    })
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || settled) return
    setPending(true)
    setError(null)
    setFieldErrors({})
    const saved = await confirmAdminProposal(widget.proposalId, editsFor(widget.mode, values))
    setPending(false)
    if (saved.fieldErrors) setFieldErrors(saved.fieldErrors)
    if (saved.error || !saved.verified) {
      setError(saved.error ?? "That change could not be saved.")
      return
    }
    setResult(saved.verified)
    onSettled?.(widget.proposalId, saved.verified)
  }

  async function cancel() {
    if (pending || settled) return
    setPending(true)
    setError(null)
    const cancelled = await cancelAdminProposal(widget.proposalId)
    setPending(false)
    if (cancelled.error) {
      setError(cancelled.error)
      return
    }
    const message = "Cancelled. Nothing was saved."
    setResult(message)
    onSettled?.(widget.proposalId, message)
  }

  return (
    <form onSubmit={(event) => void confirm(event)} className="rounded-2xl bg-[#f6f1e6] px-4 py-3 text-sm text-[#2b2433]">
      <p className="text-xs font-medium tracking-wide text-[#6d5c4a]">Confirm before saving</p>
      <p className="mt-1 leading-6">{widget.summary}</p>
      {widget.mode === "status" ? (
        <label className="mt-3 block">
          Status
          <select
            className={inputClass}
            disabled={settled}
            value={values.status}
            onChange={(event) => setField("status", event.target.value)}
          >
            {["under_review", "approved", "rejected"].map((status) => (
              <option key={status} value={status}>{label(status)}</option>
            ))}
          </select>
          <FieldError message={fieldErrors.status} />
        </label>
      ) : null}
      {widget.mode === "enroll" ? (
        <label className="mt-3 block">
          Roll number
          <input className={inputClass} disabled={settled} value={values.rollNumber} onChange={(event) => setField("rollNumber", event.target.value)} />
          <FieldError message={fieldErrors.rollNumber} />
          <p className="mt-1 text-xs text-[#6d5c4a]">The password from this request stays on the confirmation and is not shown here.</p>
        </label>
      ) : null}
      {widget.mode === "create" || widget.mode === "update" ? (
        <div className="mt-3 space-y-2">
          <Field label="Full name" error={fieldErrors.fullName}>
            <input className={inputClass} disabled={settled} value={values.fullName} onChange={(event) => setField("fullName", event.target.value)} />
          </Field>
          <Field label="Email" error={fieldErrors.email}>
            <input type="email" className={inputClass} disabled={settled} value={values.email} onChange={(event) => setField("email", event.target.value)} />
          </Field>
          <Field label="Phone" error={fieldErrors.phone}>
            <input className={inputClass} disabled={settled} value={values.phone} onChange={(event) => setField("phone", event.target.value)} />
          </Field>
          <Field label="Department" error={fieldErrors.departmentId}>
            <select className={inputClass} disabled={settled || !options} value={values.departmentId} onChange={(event) => setField("departmentId", event.target.value)}>
              <option value="">Choose a department</option>
              {(options?.departments ?? []).map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Course" error={fieldErrors.courseId}>
            <select className={inputClass} disabled={settled || !options} value={values.courseId} onChange={(event) => setField("courseId", event.target.value)}>
              <option value="">Choose a course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Semester" error={fieldErrors.semesterId}>
            <select className={inputClass} disabled={settled || !options} value={values.semesterId} onChange={(event) => setField("semesterId", event.target.value)}>
              <option value="">No semester</option>
              {semesters.map((semester) => (
                <option key={semester.id} value={semester.id}>{semester.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Notes" error={fieldErrors.notes}>
            <textarea className={inputClass} disabled={settled} rows={3} value={values.notes} onChange={(event) => setField("notes", event.target.value)} />
          </Field>
          {optionsError ? <p className="text-[#8a2f2f]">{optionsError}</p> : null}
        </div>
      ) : null}
      {error ? <p className="mt-2 text-[#8a2f2f]">{error}</p> : null}
      {result ? <p className="mt-2">{result}</p> : null}
      {settled ? null : (
        <div className="mt-3 flex gap-2">
          <button type="submit" disabled={pending} className="rounded-full bg-[#2a2436] px-3 py-1.5 text-[#f6f1e6] disabled:opacity-40">
            Confirm
          </button>
          <button type="button" disabled={pending} className="rounded-full px-3 py-1.5 underline disabled:opacity-40" onClick={() => void cancel()}>
            Cancel
          </button>
        </div>
      )}
    </form>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      {label}
      {children}
      <FieldError message={error} />
    </label>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-[#8a2f2f]">{message}</p>
}

function initialValues(widget: Extract<ChatWidget, { kind: "form" }>) {
  if (widget.mode === "create") {
    return { fullName: "", email: "", phone: "", departmentId: "", courseId: "", semesterId: "", notes: "", status: "under_review", rollNumber: "" }
  }
  return {
    fullName: widget.fields.fullName ?? "",
    email: widget.fields.email ?? "",
    phone: widget.fields.phone ?? "",
    departmentId: widget.fields.departmentId ?? "",
    courseId: widget.fields.courseId ?? "",
    semesterId: widget.fields.semesterId ?? "",
    notes: widget.fields.notes ?? "",
    status: widget.fields.status || "under_review",
    rollNumber: widget.fields.rollNumber ?? "",
  }
}

function editsFor(mode: Extract<ChatWidget, { kind: "form" }>["mode"], values: ReturnType<typeof initialValues>): Record<string, string> {
  if (mode === "status") return { status: values.status }
  if (mode === "enroll") return { rollNumber: values.rollNumber }
  return {
    fullName: values.fullName,
    email: values.email,
    phone: values.phone,
    departmentId: values.departmentId,
    courseId: values.courseId,
    semesterId: values.semesterId,
    notes: values.notes,
  }
}

function label(status: string) {
  return status.replaceAll("_", " ")
}
