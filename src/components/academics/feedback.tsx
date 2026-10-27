"use client"

import { useActionState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import type { FormState } from "@/actions/form-state"

const initialState: FormState = { error: null, success: null }

export function useFormAction(action: (previous: FormState, formData: FormData) => Promise<FormState>) {
  return useActionState(action, initialState)
}

export function FormFeedback({ state }: { state: FormState }) {
  if (!state.error && !state.success) return null
  return (
    <Alert variant={state.error ? "destructive" : "default"}>
      <AlertDescription>{state.error ?? state.success}</AlertDescription>
    </Alert>
  )
}

export { initialState }
