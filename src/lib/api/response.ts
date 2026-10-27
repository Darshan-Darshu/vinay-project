import { NextResponse } from "next/server"

export type ApiErrorBody = {
  code: string
  message: string
}

export type ApiSuccess<T> = {
  success: true
  data: T
  error: null
}

export type ApiFailure = {
  success: false
  data: null
  error: ApiErrorBody
}

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data, error: null }
}

export function fail(code: string, message: string, status: number) {
  const body: ApiFailure = {
    success: false,
    data: null,
    error: { code, message },
  }
  return NextResponse.json(body, { status })
}
