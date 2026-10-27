"use client"

import { useEffect, useState, type FormEvent } from "react"

import { loadGuestApplicationOptions, submitGuestAdmission } from "@/actions/ai/guest-admission"

type Options = Awaited<ReturnType<typeof loadGuestApplicationOptions>>

export function AdmissionChatForm() {
  const [options, setOptions] = useState<Options | null>(null)
  const [departmentId, setDepartmentId] = useState("")
  const [courseId, setCourseId] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let active = true
    void loadGuestApplicationOptions()
      .then((loaded) => {
        if (active) setOptions(loaded)
      })
      .catch(() => {
        if (active) setMessage("The application form could not be loaded.")
      })
    return () => {
      active = false
    }
  }, [])

  const courses = (options?.courses ?? []).filter((course) => course.departmentId === departmentId)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || saved) return
    setPending(true)
    setMessage(null)
    const result = await submitGuestAdmission({ error: null, success: null }, new FormData(event.currentTarget))
    setPending(false)
    if (result.error) {
      setMessage(result.error)
      return
    }
    setSaved(true)
    setMessage(result.success)
  }

  if (saved) {
    return (
      <div className="mt-2 max-w-[75%] rounded-[22px] bg-[#f6f1e6] px-4 py-4 text-sm text-[#2b2433]">
        <p className="font-medium">Thank you</p>
        <p className="mt-1 text-[#5c5348]">{message ?? "Your application has been received. The office will review it."}</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mt-2 max-w-[75%] space-y-2 rounded-[22px] bg-[#f6f1e6] p-4 text-sm text-[#2b2433]">
      <p className="font-medium">Admission application</p>
      <p className="text-[#5c5348]">The office reviews this application. It does not create a login.</p>
      <label className="block">
        Full name
        <input name="fullName" required maxLength={120} disabled={saved} className="mt-1 w-full rounded-xl border border-[#ddd4c6] bg-white px-3 py-2" />
      </label>
      <label className="block">
        Email
        <input name="email" type="email" required maxLength={120} disabled={saved} className="mt-1 w-full rounded-xl border border-[#ddd4c6] bg-white px-3 py-2" />
      </label>
      <label className="block">
        Phone
        <input name="phone" maxLength={30} disabled={saved} className="mt-1 w-full rounded-xl border border-[#ddd4c6] bg-white px-3 py-2" />
      </label>
      <label className="block">
        Department
        <select
          name="departmentId"
          required
          disabled={saved || !options}
          value={departmentId}
          className="mt-1 w-full rounded-xl border border-[#ddd4c6] bg-white px-3 py-2"
          onChange={(event) => {
            setDepartmentId(event.target.value)
            setCourseId("")
          }}
        >
          <option value="">Choose a department</option>
          {(options?.departments ?? []).map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Course
        <select
          name="courseId"
          required
          disabled={saved}
          value={courseId}
          className="mt-1 w-full rounded-xl border border-[#ddd4c6] bg-white px-3 py-2"
          onChange={(event) => setCourseId(event.target.value)}
        >
          <option value="">Choose a course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Note
        <textarea name="notes" maxLength={4000} disabled={saved} rows={3} className="mt-1 w-full rounded-xl border border-[#ddd4c6] bg-white px-3 py-2" />
      </label>
      {message ? <p className="text-[#8a3b32]">{message}</p> : null}
      <button type="submit" disabled={pending || !options} className="rounded-full bg-[#2a2436] px-4 py-2 text-[#f6f1e6] disabled:opacity-40">
        {pending ? "Submitting…" : "Submit application"}
      </button>
    </form>
  )
}
