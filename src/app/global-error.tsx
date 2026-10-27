"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body className="p-6">
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            Please try again. If the problem continues, contact the college office.
          </AlertDescription>
        </Alert>
        <button type="button" className="mt-4 text-sm underline" onClick={() => reset()}>
          Try again
        </button>
      </body>
    </html>
  )
}
