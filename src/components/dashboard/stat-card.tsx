import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card className="rounded-[28px] bg-panel shadow-none ring-0">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl font-semibold tracking-tight">
          {value}
        </CardTitle>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  )
}

export function PageHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-navy">{title}</h1>
      {description ? (
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  )
}
