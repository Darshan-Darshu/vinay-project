"use client"

import { useActionState } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { updateProfile } from "@/actions/account/profile/updateQueries"
import { updateCollegeSettings } from "@/actions/admin/settings/updateQueries"
import type { FormState } from "@/actions/form-state"
import type { CollegeSettings } from "@/actions/college/catalog/getQueries"
import type { Profile } from "@/lib/permissions/roles"

const initialState: FormState = { error: null, success: null }

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfile, initialState)

  return (
    <form action={action} className="max-w-lg space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName">Full name</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={profile.fullName}
          required
          maxLength={120}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" defaultValue={profile.email} disabled readOnly />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          defaultValue={profile.phone ?? ""}
          maxLength={30}
        />
      </div>
      <FormFeedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  )
}

export function CollegeSettingsForm({ settings }: { settings: CollegeSettings }) {
  const [state, action, pending] = useActionState(updateCollegeSettings, initialState)

  return (
    <form action={action} className="max-w-2xl space-y-4">
      <Field label="College name" name="name" defaultValue={settings.name} required />
      <TextField label="About" name="about" defaultValue={settings.about} />
      <Field label="Address" name="address" defaultValue={settings.address} />
      <Field label="Phone" name="phone" defaultValue={settings.phone} />
      <Field label="Email" name="email" type="email" defaultValue={settings.email} />
      <TextField
        label="Admissions information"
        name="admissionsInfo"
        defaultValue={settings.admissionsInfo}
      />
      <FormFeedback state={state} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  )
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
}: {
  label: string
  name: string
  defaultValue: string
  required?: boolean
  type?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
      />
    </div>
  )
}

function TextField({
  label,
  name,
  defaultValue,
}: {
  label: string
  name: string
  defaultValue: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} defaultValue={defaultValue} rows={5} />
    </div>
  )
}

function FormFeedback({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    )
  }
  if (state.success) {
    return (
      <Alert>
        <AlertDescription>{state.success}</AlertDescription>
      </Alert>
    )
  }
  return null
}
