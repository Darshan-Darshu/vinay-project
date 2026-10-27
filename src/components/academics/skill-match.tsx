import Link from "next/link"

import { loadSkillMatches } from "@/actions/ai/placement"
import { ExplainMatchButton } from "@/components/academics/ai-forms"
import { EmptyState } from "@/components/dashboard/states"

export async function SkillMatchSection() {
  const loaded = await loadSkillMatches()
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Fits your skills</h2>
      {!loaded.enrolled || loaded.skills.length === 0 ? (
        <EmptyState title="Add your skills" description="Typed skills on your profile are compared with each drive. Resume text is not read." />
      ) : loaded.matches.length === 0 ? (
        <EmptyState title="No skill overlap yet" description="Open drives that share none of your skills stay in the list below." />
      ) : (
        <ul className="space-y-3">
          {loaded.matches.map((match) => (
            <li key={match.id} className="space-y-2 rounded-[28px] bg-panel p-4">
              <p className="text-sm font-medium">
                {match.companyName} · {match.roleTitle}
              </p>
              <p className="text-sm text-muted-foreground">Shared: {match.shared.join(", ") || "None"}</p>
              <p className="text-sm text-muted-foreground">Still required: {match.missing.join(", ") || "None"}</p>
              <ExplainMatchButton driveId={match.id} />
            </li>
          ))}
        </ul>
      )}
      {!loaded.enrolled || loaded.skills.length === 0 ? (
        <Link className="text-sm underline" href="/student/profile">
          Add skills on your profile
        </Link>
      ) : null}
    </section>
  )
}
