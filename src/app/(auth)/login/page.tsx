import { Suspense } from "react"
import type { Metadata } from "next"

import { LoginForm } from "@/components/auth/login-form"
import { ConfigNotice } from "@/components/dashboard/config-notice"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentProfile } from "@/lib/auth/session"
import { homeForRole } from "@/lib/permissions/roles"
import { getSupabasePublicEnv } from "@/lib/supabase/env"
import { beginRequest } from "@/lib/request"
import { redirect, unstable_rethrow } from "next/navigation"

export const metadata: Metadata = { title: "Sign in" }

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading sign in…</p>}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  )
}

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  await beginRequest()
  if (!getSupabasePublicEnv()) {
    return <ConfigNotice fullPage />
  }

  let profile: Awaited<ReturnType<typeof getCurrentProfile>> = null
  try {
    profile = await getCurrentProfile()
  } catch (error) {
    unstable_rethrow(error)
  }
  if (profile?.isActive) {
    redirect(homeForRole(profile.role))
  }

  const params = await searchParams
  const nextPath = allowedNext(params.next)

  return (
    <div id="main" className="portal-light grid min-h-dvh bg-white md:grid-cols-2">
      <aside className="flex min-h-[42vh] flex-col bg-navy px-8 py-10 text-white sm:px-12 md:min-h-dvh md:px-16 md:py-14">
        <p className="text-sm text-white/60">College portal</p>
        <div className="flex flex-1 items-center">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back</h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">
              Sign in with the account the college created for you.
            </p>
          </div>
        </div>
      </aside>
      <div className="flex items-center justify-center px-6 py-12 sm:px-12">
        <Card className="w-full max-w-md border-0 shadow-none ring-0">
          <CardHeader className="px-0">
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>
              Use the email and password created for your college account.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {params.error === "inactive" ? (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>This account is inactive.</AlertDescription>
              </Alert>
            ) : null}
            <LoginForm nextPath={nextPath} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function allowedNext(value: string | undefined) {
  if (!value) return ""
  if (
    value.startsWith("/admin") ||
    value.startsWith("/teacher") ||
    value.startsWith("/student")
  ) {
    return value
  }
  return ""
}
