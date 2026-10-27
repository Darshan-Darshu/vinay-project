"use client"

import { useActionState } from "react"

import { uploadCollegePdf } from "@/actions/ai/upload-college-pdf"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { FormState } from "@/actions/form-state"

const initialState: FormState = { error: null, success: null }

export function CollegePdfForm() {
  const [state, action, pending] = useActionState(uploadCollegePdf, initialState)

  return (
    <form action={action} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required maxLength={160} placeholder="College handbook" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="file">PDF</Label>
        <Input id="file" name="file" type="file" accept="application/pdf,.pdf" required />
      </div>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.success ? (
        <Alert>
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Adding to search…" : "Upload PDF"}
      </Button>
    </form>
  )
}
