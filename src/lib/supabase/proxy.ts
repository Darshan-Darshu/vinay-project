import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { homeForRole, isAppRole } from "@/lib/permissions/roles"
import { getSupabasePublicEnv } from "@/lib/supabase/env"

export async function updateSession(request: NextRequest) {
  const env = getSupabasePublicEnv()
  if (!env) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }

        supabaseResponse = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options)
        }
        for (const [key, value] of Object.entries(headers)) {
          supabaseResponse.headers.set(key, value)
        }
      },
    },
  })

  const { pathname } = request.nextUrl
  if (!hasAuthCookie(request)) {
    return gate(request, supabaseResponse, null)
  }

  let userId: string | null = null
  try {
    const { data, error } = await supabase.auth.getClaims()
    if (error) {
      if (isStaleSession(error)) clearAuthCookies(request, supabaseResponse)
      else if (isTransientAuthError(error)) return supabaseResponse
    } else if (typeof data?.claims?.sub === "string") {
      userId = data.claims.sub
    }
  } catch (error) {
    if (isStaleSession(error)) clearAuthCookies(request, supabaseResponse)
    else return supabaseResponse
  }

  if (!userId) {
    return gate(request, supabaseResponse, null)
  }

  if (!isEntryPath(pathname)) {
    return gate(request, supabaseResponse, userId)
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle()

  if (profileError || !profile || profile.is_active !== true || !isAppRole(profile.role)) {
    if (!profileError) await supabase.auth.signOut()
    if (pathname === "/login") return supabaseResponse
    return redirectTo(request, supabaseResponse, "/login")
  }

  const home = homeForRole(profile.role)
  if (pathname === home || pathname.startsWith(`${home}/`)) {
    return supabaseResponse
  }
  return redirectTo(request, supabaseResponse, home)
}

function gate(request: NextRequest, supabaseResponse: NextResponse, userId: string | null) {
  const { pathname } = request.nextUrl
  const isProtected =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/teacher") ||
    pathname.startsWith("/student")

  if (!userId && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("next", pathname)
    return redirectTo(request, supabaseResponse, `${url.pathname}?${url.searchParams.toString()}`)
  }

  return supabaseResponse
}

function isEntryPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/enter" ||
    pathname === "/guest" ||
    pathname.startsWith("/guest/")
  )
}

function hasAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-") && cookie.value)
}

function isStaleSession(error: unknown) {
  const code = errorCode(error)
  return (
    code === "refresh_token_not_found" ||
    code === "refresh_token_already_used" ||
    code === "session_not_found" ||
    code === "session_expired"
  )
}

function isTransientAuthError(error: unknown) {
  const status = errorStatus(error)
  return status === 429 || status >= 500
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return ""
  return String(error.code)
}

function errorStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) return 0
  return Number(error.status) || 0
}

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.startsWith("sb-")) continue
    response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" })
  }
}

function redirectTo(request: NextRequest, source: NextResponse, path: string) {
  const url = request.nextUrl.clone()
  const [pathname, search] = path.split("?")
  url.pathname = pathname || "/"
  url.search = search ? `?${search}` : ""
  return copyResponse(source, NextResponse.redirect(url))
}

function copyResponse(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie)
  }
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(header)
    if (value) target.headers.set(header, value)
  }
  return target
}
