import type { Metadata } from "next"

import { CollegePdfForm } from "@/components/forms/college-pdf-form"
import { PageHeader } from "@/components/dashboard/stat-card"

export const metadata: Metadata = { title: "College documents" }

export default function CollegeDocumentsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <PageHeader
        title="College documents"
        description="Upload a PDF to add it to the guest assistant's search. No sign-in is required."
      />
      <CollegePdfForm />
    </div>
  )
}
