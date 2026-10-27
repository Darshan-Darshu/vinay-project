"use client"

import { QueryErrorState } from "@/components/dashboard/states"
import { Button } from "@/components/ui/button"

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <QueryErrorState />
      <Button type="button" variant="outline" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  )
}
