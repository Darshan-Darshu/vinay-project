import { Suspense } from "react"

import { loadResume } from "@/actions/academics/resume"
import { ResumeForm } from "@/components/academics/paper-forms"
import { PageHeader } from "@/components/dashboard/stat-card"
import { EmptyState } from "@/components/dashboard/states"
import { ProfileForm } from "@/components/forms/account-forms"
import { requireUser } from "@/lib/auth/session"

export function ProfilePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading profile…</p>}>
      <ProfileContent />
    </Suspense>
  )
}

async function ProfileContent() {
  const profile = await requireUser()
  const resume = profile.role === "student" ? await loadResume() : { kind: "hidden" as const }
  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          title="Profile"
          description="Update the name and phone on your college account. Your role is managed by the college."
        />
        <ProfileForm profile={profile} />
      </div>
      {resume.kind === "unenrolled" ? (
        <EmptyState title="Waiting for enrollment" description="Your enrollment is not on file yet." />
      ) : null}
      {resume.kind === "ready" ? (
        <section>
          <PageHeader
            title="Resume"
            description="Upload a PDF and list the skills you want compared with placement drives later."
          />
          <ResumeForm fileName={resume.resume.fileName} skills={resume.resume.skills} href={resume.resume.href} />
        </section>
      ) : null}
    </div>
  )
}
