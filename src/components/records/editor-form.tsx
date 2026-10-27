"use client"

import { useActionState, useEffect, useRef, useState } from "react"

import {
  enrollAdmission,
  saveAdmission,
  saveStudent,
  saveTeacher,
  setAdmissionStatus,
} from "@/actions/admin/records/save-people"
import {
  saveAcademicYear,
  saveCourse,
  saveDepartment,
  saveSemester,
  saveSubject,
} from "@/actions/admin/records/save-catalog"
import { saveAnnouncement, saveEvent } from "@/actions/admin/records/save-campus"
import { savePlacementDrive, setPlacementApplicationStatus } from "@/actions/admin/records/save-placements"
import type {
  AcademicYearValues,
  AdmissionValues,
  AnnouncementValues,
  CourseOption,
  CourseValues,
  DepartmentValues,
  EditorOptions,
  EditorRecord,
  EventValues,
  NamedOption,
  PlacementValues,
  SemesterValues,
  StudentValues,
  SubjectValues,
  TeacherValues,
} from "@/actions/admin/records/types"
import type { EditorKind } from "@/actions/records/types"
import type { FormState } from "@/actions/form-state"
import { toDateTimeLocal } from "@/lib/format"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const initialState: FormState = { error: null, success: null }

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

type Complete = (message: string, created: boolean, reload: boolean) => void

export function EditorForm({
  kind,
  record,
  options,
  onComplete,
}: {
  kind: EditorKind
  record: EditorRecord | null
  options: EditorOptions
  onComplete: Complete
}) {
  switch (kind) {
    case "department":
      return (
        <DepartmentForm
          values={record?.kind === "department" ? record.values : null}
          onComplete={onComplete}
        />
      )
    case "course":
      return (
        <CourseForm
          values={record?.kind === "course" ? record.values : null}
          options={options}
          onComplete={onComplete}
        />
      )
    case "subject":
      return (
        <SubjectForm
          values={record?.kind === "subject" ? record.values : null}
          options={options}
          onComplete={onComplete}
        />
      )
    case "academic-year":
      return (
        <YearForm
          values={record?.kind === "academic-year" ? record.values : null}
          onComplete={onComplete}
        />
      )
    case "semester":
      return (
        <SemesterForm
          values={record?.kind === "semester" ? record.values : null}
          options={options}
          onComplete={onComplete}
        />
      )
    case "teacher":
      return (
        <TeacherForm
          values={record?.kind === "teacher" ? record.values : null}
          options={options}
          onComplete={onComplete}
        />
      )
    case "student":
      return record?.kind === "student" ? (
        <StudentForm values={record.values} options={options} onComplete={onComplete} />
      ) : null
    case "admission":
      return (
        <AdmissionForm
          values={record?.kind === "admission" ? record.values : null}
          options={options}
          onComplete={onComplete}
        />
      )
    case "announcement":
      return (
        <AnnouncementForm
          values={record?.kind === "announcement" ? record.values : null}
          options={options}
          onComplete={onComplete}
        />
      )
    case "event":
      return (
        <EventForm
          values={record?.kind === "event" ? record.values : null}
          sports={false}
          onComplete={onComplete}
        />
      )
    case "sports":
      return (
        <EventForm
          values={record?.kind === "sports" ? record.values : null}
          sports
          onComplete={onComplete}
        />
      )
    case "placement":
      return (
        <PlacementForm
          values={record?.kind === "placement" ? record.values : null}
          options={options}
          onComplete={onComplete}
        />
      )
  }
}

function PlacementForm({
  values,
  options,
  onComplete,
}: {
  values: PlacementValues | null
  options: EditorOptions
  onComplete: Complete
}) {
  const [departmentId, setDepartmentId] = useState(values?.departmentId ?? "")
  const [courseId, setCourseId] = useState(values?.courseId ?? "")
  const courses = departmentId
    ? options.courses.filter((course) => course.departmentId === departmentId)
    : options.courses
  return (
    <div className="space-y-6">
      <SaveForm action={savePlacementDrive} created={!values} onComplete={onComplete} label="Save company">
        {values ? <Hidden name="id" value={values.id} /> : null}
        <TextInput label="Company" name="companyName" defaultValue={values?.companyName ?? ""} required maxLength={160} />
        <TextInput label="Role" name="roleTitle" defaultValue={values?.roleTitle ?? ""} required maxLength={160} />
        <Area label="About the visit" name="description" defaultValue={values?.description ?? ""} />
        <TextInput label="Package" name="packageText" defaultValue={values?.packageText ?? ""} maxLength={80} />
        <TextInput label="Work location" name="location" defaultValue={values?.location ?? ""} maxLength={160} />
        <FixedChoice
          label="Offer"
          name="jobType"
          defaultValue={values?.jobType ?? "full_time"}
          options={[
            ["full_time", "Full time"],
            ["internship", "Internship"],
          ]}
        />
        <Area
          label="Who may apply"
          name="eligibility"
          defaultValue={values?.eligibility ?? ""}
          hint="Leave the department and course blank when every student may apply."
        />
        <Area
          label="Required skills"
          name="requiredSkills"
          defaultValue={values?.requiredSkills ?? ""}
          hint="Comma-separated skills used later to compare a student's resume. Example: java, sql."
        />
        <ControlledChoice
          label="Department"
          name="departmentId"
          value={departmentId}
          options={options.departments}
          empty="Any department"
          onChange={(next) => {
            setDepartmentId(next)
            setCourseId("")
          }}
        />
        <CourseChoice
          courses={courses}
          value={courseId}
          allowEmpty
          emptyLabel="Any course"
          onChange={setCourseId}
        />
        <TextInput label="Campus venue" name="venue" defaultValue={values?.venue ?? ""} maxLength={160} />
        <TextInput
          label="Last date to apply"
          name="applyBy"
          type="datetime-local"
          defaultValue={values?.applyBy ?? ""}
          required
        />
        <TextInput label="Visit date" name="visitAt" type="datetime-local" defaultValue={values?.visitAt ?? ""} />
        <FixedChoice
          label="Status"
          name="status"
          defaultValue={values?.status ?? "draft"}
          options={[
            ["draft", "Draft"],
            ["open", "Open"],
            ["closed", "Closed"],
          ]}
        />
      </SaveForm>
      {values ? <ApplicantList applicants={values.applicants} onComplete={onComplete} /> : null}
    </div>
  )
}

function ApplicantList({
  applicants,
  onComplete,
}: {
  applicants: PlacementValues["applicants"]
  onComplete: Complete
}) {
  if (applicants.length === 0) {
    return <p className="text-sm text-muted-foreground">No students have applied yet.</p>
  }
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Students who applied</h3>
      <ul className="space-y-3">
        {applicants.map((applicant) => (
          <li key={applicant.id} className="rounded-2xl bg-panel p-3">
            <p className="text-sm font-medium">{applicant.studentName}</p>
            <p className="text-xs text-muted-foreground">
              {[applicant.rollNumber, applicant.courseName, applicant.departmentName].filter(Boolean).join(" · ")}
            </p>
            <SaveForm
              action={setPlacementApplicationStatus}
              created={false}
              reload
              onComplete={onComplete}
              label="Update status"
              quiet
            >
              <Hidden name="id" value={applicant.id} />
              <FixedChoice
                label="Application"
                name="status"
                defaultValue={applicant.status}
                options={[
                  ["applied", "Applied"],
                  ["shortlisted", "Shortlisted"],
                  ["selected", "Selected"],
                  ["not_selected", "Not selected"],
                ]}
              />
            </SaveForm>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DepartmentForm({
  values,
  onComplete,
}: {
  values: DepartmentValues | null
  onComplete: Complete
}) {
  return (
    <SaveForm action={saveDepartment} created={!values} onComplete={onComplete}>
      {values ? <Hidden name="id" value={values.id} /> : null}
      <TextInput label="Name" name="name" defaultValue={values?.name ?? ""} required maxLength={120} />
      <TextInput label="Code" name="code" defaultValue={values?.code ?? ""} required maxLength={32} />
      <Area label="Description" name="description" defaultValue={values?.description ?? ""} />
      <CheckField name="isActive" label="Active" defaultChecked={values?.isActive ?? true} />
    </SaveForm>
  )
}

function CourseForm({
  values,
  options,
  onComplete,
}: {
  values: CourseValues | null
  options: EditorOptions
  onComplete: Complete
}) {
  if (options.departments.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a department before creating a course.</p>
  }
  return (
    <SaveForm action={saveCourse} created={!values} onComplete={onComplete}>
      {values ? <Hidden name="id" value={values.id} /> : null}
      <Choice
        label="Department"
        name="departmentId"
        defaultValue={values?.departmentId ?? ""}
        required
        options={options.departments}
      />
      <TextInput label="Name" name="name" defaultValue={values?.name ?? ""} required maxLength={120} />
      <TextInput label="Code" name="code" defaultValue={values?.code ?? ""} required maxLength={32} />
      <TextInput
        label="Duration in semesters"
        name="durationSemesters"
        type="number"
        defaultValue={String(values?.durationSemesters ?? 6)}
        required
        min={1}
        max={12}
      />
      <Area label="Description" name="description" defaultValue={values?.description ?? ""} />
      <CheckField name="isActive" label="Active" defaultChecked={values?.isActive ?? true} />
    </SaveForm>
  )
}

function SubjectForm({
  values,
  options,
  onComplete,
}: {
  values: SubjectValues | null
  options: EditorOptions
  onComplete: Complete
}) {
  const [departmentId, setDepartmentId] = useState(values?.departmentId ?? "")
  const [courseId, setCourseId] = useState(values?.courseId ?? "")
  const courses = options.courses.filter((course) => course.departmentId === departmentId)
  const course = courses.find((item) => item.id === courseId) ?? null
  if (options.departments.length === 0) {
    return <p className="text-sm text-muted-foreground">Add a department and a course before creating a subject.</p>
  }
  return (
    <SaveForm action={saveSubject} created={!values} onComplete={onComplete}>
      {values ? <Hidden name="id" value={values.id} /> : null}
      <ControlledChoice
        label="Department"
        name="departmentId"
        value={departmentId}
        required
        options={options.departments}
        onChange={(next) => {
          setDepartmentId(next)
          setCourseId("")
        }}
      />
      <CourseChoice
        courses={courses}
        value={courseId}
        onChange={setCourseId}
      />
      <SemesterNumber
        key={courseId}
        name="semesterNumber"
        max={course?.durationSemesters ?? 0}
        defaultValue={courseId === values?.courseId ? values?.semesterNumber : undefined}
      />
      <TextInput label="Name" name="name" defaultValue={values?.name ?? ""} required maxLength={120} />
      <TextInput label="Code" name="code" defaultValue={values?.code ?? ""} required maxLength={32} />
      <TextInput
        label="Credits"
        name="credits"
        type="number"
        defaultValue={String(values?.credits ?? 0)}
        required
        min={0}
        max={99}
      />
      <CheckField name="isActive" label="Active" defaultChecked={values?.isActive ?? true} />
    </SaveForm>
  )
}

function YearForm({
  values,
  onComplete,
}: {
  values: AcademicYearValues | null
  onComplete: Complete
}) {
  return (
    <SaveForm action={saveAcademicYear} created={!values} onComplete={onComplete} label="Save year">
      {values ? <Hidden name="id" value={values.id} /> : null}
      <TextInput label="Name" name="name" defaultValue={values?.name ?? ""} required maxLength={40} />
      <TextInput label="Starts" name="startsOn" type="date" defaultValue={values?.startsOn ?? ""} required />
      <TextInput label="Ends" name="endsOn" type="date" defaultValue={values?.endsOn ?? ""} required />
      <CheckField name="isCurrent" label="Current year" defaultChecked={values?.isCurrent ?? false} />
    </SaveForm>
  )
}

function SemesterForm({
  values,
  options,
  onComplete,
}: {
  values: SemesterValues | null
  options: EditorOptions
  onComplete: Complete
}) {
  const [courseId, setCourseId] = useState(values?.courseId ?? "")
  const course = options.courses.find((item) => item.id === courseId) ?? null
  if (options.courses.length === 0 || options.years.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add a course and an academic year before creating a semester.
      </p>
    )
  }
  return (
    <SaveForm action={saveSemester} created={!values} onComplete={onComplete}>
      {values ? <Hidden name="id" value={values.id} /> : null}
      <CourseChoice courses={options.courses} value={courseId} onChange={setCourseId} />
      <Choice
        label="Academic year"
        name="academicYearId"
        defaultValue={values?.academicYearId ?? ""}
        required
        options={options.years}
      />
      <SemesterNumber name="number" max={course?.durationSemesters ?? 0} defaultValue={values?.number} />
      <CheckField name="isActive" label="Active" defaultChecked={values?.isActive ?? true} />
    </SaveForm>
  )
}

function TeacherForm({
  values,
  options,
  onComplete,
}: {
  values: TeacherValues | null
  options: EditorOptions
  onComplete: Complete
}) {
  return (
    <SaveForm action={saveTeacher} created={!values} onComplete={onComplete}>
      {values ? <Hidden name="id" value={values.id} /> : null}
      <TextInput label="Full name" name="fullName" defaultValue={values?.fullName ?? ""} required maxLength={120} />
      {values ? (
        <TextInput label="Email" name="emailDisplay" defaultValue={values.email} readOnly />
      ) : (
        <TextInput label="Email" name="email" type="email" defaultValue="" required />
      )}
      <TextInput label="Phone" name="phone" defaultValue={values?.phone ?? ""} maxLength={30} />
      {values ? null : (
        <TextInput
          label="Initial password"
          name="password"
          type="password"
          defaultValue=""
          required
          min={6}
          autoComplete="new-password"
        />
      )}
      <Choice
        label="Department"
        name="departmentId"
        defaultValue={values?.departmentId ?? ""}
        options={options.departments}
        empty="No department"
      />
      <TextInput label="Employee code" name="employeeCode" defaultValue={values?.employeeCode ?? ""} maxLength={40} />
      <TextInput label="Designation" name="designation" defaultValue={values?.designation ?? ""} maxLength={80} />
      <SubjectChecks subjects={options.subjects} selected={values?.subjectIds ?? []} />
      <CheckField name="isActive" label="Active" defaultChecked={values?.isActive ?? true} />
    </SaveForm>
  )
}

function StudentForm({
  values,
  options,
  onComplete,
}: {
  values: StudentValues
  options: EditorOptions
  onComplete: Complete
}) {
  const [departmentId, setDepartmentId] = useState(values.departmentId)
  const [courseId, setCourseId] = useState(values.courseId)
  const [semesterId, setSemesterId] = useState(values.semesterId)
  const courses = options.courses.filter((course) => course.departmentId === departmentId)
  return (
    <SaveForm action={saveStudent} created={false} onComplete={onComplete}>
      <Hidden name="id" value={values.id} />
      <TextInput label="Name" name="fullNameDisplay" defaultValue={values.fullName} readOnly />
      <TextInput label="Email" name="emailDisplay" defaultValue={values.email} readOnly />
      <TextInput label="Roll number" name="rollNumber" defaultValue={values.rollNumber} required maxLength={40} />
      <ControlledChoice
        label="Department"
        name="departmentId"
        value={departmentId}
        options={options.departments}
        empty="No department"
        onChange={(next) => {
          setDepartmentId(next)
          setCourseId("")
          setSemesterId("")
        }}
      />
      <CourseChoice
        courses={courses}
        value={courseId}
        allowEmpty
        onChange={(next) => {
          setCourseId(next)
          setSemesterId("")
        }}
      />
      <SemesterChoice
        options={options}
        courseId={courseId}
        value={semesterId}
        onChange={setSemesterId}
      />
      <CheckField name="isActive" label="Active" defaultChecked={values.isActive} />
    </SaveForm>
  )
}

function AdmissionForm({
  values,
  options,
  onComplete,
}: {
  values: AdmissionValues | null
  options: EditorOptions
  onComplete: Complete
}) {
  const locked = values?.status === "completed"
  const [departmentId, setDepartmentId] = useState(values?.departmentId ?? "")
  const [courseId, setCourseId] = useState(values?.courseId ?? "")
  const [semesterId, setSemesterId] = useState(values?.semesterId ?? "")
  const courses = options.courses.filter((course) => course.departmentId === departmentId)
  const moves = statusMoves[values?.status ?? ""] ?? []
  return (
    <div className="space-y-4">
      {values ? <p className="text-sm text-muted-foreground">Status: {statusText(values.status)}</p> : null}
      <SaveForm action={saveAdmission} created={!values} onComplete={onComplete} label={locked ? "Save notes" : "Save"}>
        {values ? <Hidden name="id" value={values.id} /> : null}
        <TextInput label="Full name" name="fullName" defaultValue={values?.fullName ?? ""} required maxLength={120} readOnly={locked} />
        <TextInput label="Email" name="email" type="email" defaultValue={values?.email ?? ""} required readOnly={locked} />
        <TextInput label="Phone" name="phone" defaultValue={values?.phone ?? ""} maxLength={30} readOnly={locked} />
        <ControlledChoice
          label="Department"
          name="departmentId"
          value={departmentId}
          required
          disabled={locked}
          options={options.departments}
          onChange={(next) => {
            setDepartmentId(next)
            setCourseId("")
          }}
        />
        <CourseChoice
          courses={courses}
          value={courseId}
          disabled={locked}
          onChange={(next) => {
            setCourseId(next)
            setSemesterId("")
          }}
        />
        <SemesterChoice
          options={options}
          courseId={courseId}
          value={semesterId}
          disabled={locked}
          onChange={setSemesterId}
        />
        <Area
          label="Notes"
          name="notes"
          defaultValue={values?.notes ?? ""}
          hint="Use notes when the office is filing this for a parent."
        />
      </SaveForm>
      {values && moves.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {moves.map((move) => (
            <StatusButton
              key={move.status}
              id={values.id}
              status={move.status}
              label={move.label}
              onComplete={onComplete}
            />
          ))}
        </div>
      ) : null}
      {values?.status === "approved" ? (
        <EnrollForm id={values.id} onComplete={onComplete} />
      ) : null}
    </div>
  )
}

function AnnouncementForm({
  values,
  options,
  onComplete,
}: {
  values: AnnouncementValues | null
  options: EditorOptions
  onComplete: Complete
}) {
  return (
    <SaveForm action={saveAnnouncement} created={!values} onComplete={onComplete}>
      {values ? <Hidden name="id" value={values.id} /> : null}
      <TextInput label="Title" name="title" defaultValue={values?.title ?? ""} required maxLength={160} />
      <Area label="Body" name="body" defaultValue={values?.body ?? ""} />
      <FixedChoice
        label="Audience"
        name="audience"
        defaultValue={values?.audience ?? "everyone"}
        options={[
          ["everyone", "Everyone"],
          ["students", "Students"],
          ["teachers", "Teachers"],
          ["admins", "Admins"],
        ]}
      />
      <Choice
        label="Department"
        name="departmentId"
        defaultValue={values?.departmentId ?? ""}
        options={options.departments}
        empty="Whole college"
      />
      <FixedChoice
        label="Priority"
        name="priority"
        defaultValue={values?.priority ?? "normal"}
        options={[
          ["low", "Low"],
          ["normal", "Normal"],
          ["high", "High"],
        ]}
      />
      <TextInput
        label="Publish at"
        name="publishAt"
        type="datetime-local"
        defaultValue={values?.publishAt || toDateTimeLocal(new Date().toISOString())}
        required
      />
      <TextInput label="Expires at" name="expiresAt" type="datetime-local" defaultValue={values?.expiresAt ?? ""} />
      <FixedChoice
        label="Status"
        name="status"
        defaultValue={values?.status ?? "draft"}
        options={[
          ["draft", "Draft"],
          ["published", "Published"],
        ]}
      />
    </SaveForm>
  )
}

function EventForm({
  values,
  sports,
  onComplete,
}: {
  values: EventValues | null
  sports: boolean
  onComplete: Complete
}) {
  return (
    <SaveForm action={saveEvent} created={!values} onComplete={onComplete} label={sports ? "Save fixture" : "Save"}>
      {values ? <Hidden name="id" value={values.id} /> : null}
      <TextInput label="Title" name="title" defaultValue={values?.title ?? ""} required maxLength={160} />
      <Area label="Description" name="description" defaultValue={values?.description ?? ""} />
      {sports ? (
        <Hidden name="eventType" value="sports" />
      ) : (
        <FixedChoice
          label="Type"
          name="eventType"
          defaultValue={values?.eventType ?? "technical"}
          options={[
            ["technical", "Technical"],
            ["cultural", "Cultural"],
            ["workshop", "Workshop"],
            ["seminar", "Seminar"],
            ["hackathon", "Hackathon"],
            ["fest", "Fest"],
          ]}
        />
      )}
      <TextInput label="Starts" name="startsAt" type="datetime-local" defaultValue={values?.startsAt ?? ""} required />
      <TextInput label="Ends" name="endsAt" type="datetime-local" defaultValue={values?.endsAt ?? ""} />
      <TextInput label="Venue" name="venue" defaultValue={values?.venue ?? ""} maxLength={160} />
      <FixedChoice
        label="Status"
        name="status"
        defaultValue={values?.status ?? "draft"}
        options={[
          ["draft", "Draft"],
          ["published", "Published"],
          ["cancelled", "Cancelled"],
          ["completed", "Completed"],
        ]}
      />
      <CheckField name="isPublic" label="Show on the public site" defaultChecked={values?.isPublic ?? false} />
    </SaveForm>
  )
}

function EnrollForm({ id, onComplete }: { id: string; onComplete: Complete }) {
  return (
    <div className="space-y-3 rounded-2xl bg-background p-3">
      <p className="text-sm font-medium">Enroll student</p>
      <p className="text-sm text-muted-foreground">Save any application changes first. Enrollment uses the saved email, department, and course.</p>
      <SaveForm action={enrollAdmission} created={false} reload onComplete={onComplete} label="Enroll">
        <Hidden name="id" value={id} />
        <TextInput label="Roll number" name="rollNumber" defaultValue="" required maxLength={40} />
        <TextInput
          label="Initial password"
          name="password"
          type="password"
          defaultValue=""
          required
          min={6}
          autoComplete="new-password"
        />
      </SaveForm>
    </div>
  )
}

function StatusButton({
  id,
  status,
  label,
  onComplete,
}: {
  id: string
  status: string
  label: string
  onComplete: Complete
}) {
  return (
    <SaveForm action={setAdmissionStatus} created={false} reload onComplete={onComplete} label={label} quiet>
      <Hidden name="id" value={id} />
      <Hidden name="status" value={status} />
    </SaveForm>
  )
}

const statusMoves: Record<string, { status: string; label: string }[]> = {
  applied: [{ status: "under_review", label: "Mark in review" }],
  under_review: [
    { status: "approved", label: "Approve" },
    { status: "rejected", label: "Reject" },
  ],
  approved: [{ status: "rejected", label: "Reject" }],
  rejected: [{ status: "under_review", label: "Move back to review" }],
}

function statusText(status: string) {
  const labels: Record<string, string> = {
    applied: "Applied",
    under_review: "In review",
    approved: "Approved",
    rejected: "Rejected",
    completed: "Enrolled",
  }
  return labels[status] ?? status
}

function SaveForm({
  action,
  created,
  reload = false,
  onComplete,
  label = "Save",
  quiet = false,
  children,
}: {
  action: (previous: FormState, formData: FormData) => Promise<FormState>
  created: boolean
  reload?: boolean
  onComplete: Complete
  label?: string
  quiet?: boolean
  children: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const handled = useRef<FormState | null>(null)
  useEffect(() => {
    if (!state.success || handled.current === state) return
    handled.current = state
    onComplete(state.success, created, reload)
  }, [state, created, reload, onComplete])

  if (state.success && created) return null
  return (
    <form action={formAction} className={quiet ? "" : "space-y-4"}>
      {children}
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.success && !reload ? (
        <Alert>
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" variant={quiet ? "outline" : "default"} disabled={pending}>
        {pending ? "Saving…" : label}
      </Button>
    </form>
  )
}

function Hidden({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />
}

function TextInput({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  maxLength,
  min,
  max,
  readOnly,
  autoComplete,
}: {
  label: string
  name: string
  defaultValue: string
  required?: boolean
  type?: string
  maxLength?: number
  min?: number
  max?: number
  readOnly?: boolean
  autoComplete?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={readOnly ? undefined : name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        min={min}
        max={max}
        readOnly={readOnly}
        autoComplete={autoComplete}
      />
    </div>
  )
}

function Area({
  label,
  name,
  defaultValue,
  hint,
}: {
  label: string
  name: string
  defaultValue: string
  hint?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} defaultValue={defaultValue} rows={4} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function SubjectChecks({
  subjects,
  selected,
}: {
  subjects: EditorOptions["subjects"]
  selected: string[]
}) {
  const chosen = new Set(selected)
  const visible = subjects.filter((subject) => !subject.inactive || chosen.has(subject.id))
  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">Add subjects before assigning them to a teacher.</p>
  }
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Subjects</legend>
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl bg-panel p-3">
        {visible.map((subject) => (
          <label key={subject.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="subjectIds"
              value={subject.id}
              defaultChecked={chosen.has(subject.id)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              {subject.name}
              {subject.courseName ? (
                <span className="block text-xs text-muted-foreground">{subject.courseName}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function CheckField({
  name,
  label,
  defaultChecked,
}: {
  name: string
  label: string
  defaultChecked?: boolean
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} value="true" defaultChecked={defaultChecked} className="size-4 accent-primary" />
      {label}
    </label>
  )
}

function Choice({
  label,
  name,
  defaultValue,
  options,
  required,
  empty,
}: {
  label: string
  name: string
  defaultValue: string
  options: NamedOption[]
  required?: boolean
  empty?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={defaultValue} required={required} className={selectClass}>
        <option value="">{empty ?? "Select"}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.inactive ? `${option.name} (inactive)` : option.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function ControlledChoice({
  label,
  name,
  value,
  options,
  required,
  empty,
  disabled,
  onChange,
}: {
  label: string
  name: string
  value: string
  options: NamedOption[]
  required?: boolean
  empty?: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={disabled ? undefined : name}
        value={value}
        required={required}
        disabled={disabled}
        className={selectClass}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{empty ?? "Select"}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.inactive ? `${option.name} (inactive)` : option.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function CourseChoice({
  courses,
  value,
  onChange,
  allowEmpty,
  emptyLabel,
  disabled,
}: {
  courses: CourseOption[]
  value: string
  onChange: (value: string) => void
  allowEmpty?: boolean
  emptyLabel?: string
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="courseId">Course</Label>
      <select
        id="courseId"
        name={disabled ? undefined : "courseId"}
        value={value}
        required={!allowEmpty && !disabled}
        disabled={disabled}
        className={selectClass}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{allowEmpty ? (emptyLabel ?? "No course") : "Select a course"}</option>
        {courses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.inactive ? `${course.name} (inactive)` : course.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function SemesterChoice({
  options,
  courseId,
  value,
  disabled,
  onChange,
}: {
  options: EditorOptions
  courseId: string
  value: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const semesters = options.semesters.filter((semester) => semester.courseId === courseId)
  return (
    <div className="space-y-2">
      <Label htmlFor="semesterId">Semester</Label>
      <select
        id="semesterId"
        name={disabled ? undefined : "semesterId"}
        value={value}
        disabled={disabled}
        className={selectClass}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">No semester yet</option>
        {semesters.map((semester) => (
          <option key={semester.id} value={semester.id}>
            {semester.inactive ? `${semester.label} (inactive)` : semester.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function SemesterNumber({
  name,
  max,
  defaultValue,
}: {
  name: string
  max: number
  defaultValue?: number
}) {
  const count = Math.max(0, max)
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>Semester number</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ? String(defaultValue) : ""}
        required
        disabled={count === 0}
        className={selectClass}
      >
        <option value="">Select</option>
        {Array.from({ length: count }, (_, index) => String(index + 1)).map((number) => (
          <option key={number} value={number}>
            {number}
          </option>
        ))}
      </select>
    </div>
  )
}

function FixedChoice({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string
  name: string
  defaultValue: string
  options: [string, string][]
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={defaultValue} className={selectClass}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  )
}
