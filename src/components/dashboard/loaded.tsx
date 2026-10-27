import { unstable_rethrow } from "next/navigation"

import { QueryErrorState } from "@/components/dashboard/states"

export async function Loaded<T>({
  loader,
  children,
}: {
  loader: () => Promise<T>
  children: (data: T) => React.ReactNode
}) {
  try {
    const data = await loader()
    return children(data)
  } catch (error) {
    unstable_rethrow(error)
    return <QueryErrorState />
  }
}
