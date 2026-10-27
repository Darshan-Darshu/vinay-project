import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function ConfigNotice({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div
      className={
        fullPage
          ? "mx-auto flex min-h-screen max-w-lg items-center px-4"
          : "mx-auto max-w-lg"
      }
    >
      <Alert>
        <AlertTitle>The portal is not connected</AlertTitle>
        <AlertDescription>
          The college office still needs to finish connecting this portal. Please try again later.
        </AlertDescription>
      </Alert>
    </div>
  )
}
