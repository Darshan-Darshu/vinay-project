import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        That address is not part of the college platform.
      </p>
      <Button asChild className="w-fit">
        <Link href="/">Back home</Link>
      </Button>
    </div>
  )
}
