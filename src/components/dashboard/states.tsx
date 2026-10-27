import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function QueryErrorState() {
  return (
    <Alert variant="destructive">
      <AlertTitle>We couldn&apos;t load this page</AlertTitle>
      <AlertDescription>
        Please try again. If this continues, ask the office.
      </AlertDescription>
    </Alert>
  )
}

export function EmptyState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-[28px] bg-panel px-4 py-8 text-center">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  )
}
