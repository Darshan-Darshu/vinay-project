"use client"

import { useState } from "react"

import { cancelAdminProposal, confirmAdminProposal } from "@/actions/ai/admin-proposals"
import { AdmissionForm } from "@/components/academics/chat-widgets/admission-widgets"
import { admissionFormWidget } from "@/lib/ai/chat-widgets"
import type { AdminProposalCard } from "@/lib/ai/admin-harness"

export function ProposalCards({
  proposals,
  onSettled,
}: {
  proposals: AdminProposalCard[]
  onSettled?: (proposalId: string, result: string) => void
}) {
  if (proposals.length === 0) return null
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
      {proposals.map((proposal) => {
        const widget = admissionFormWidget(proposal)
        if (widget) return <AdmissionForm key={proposal.id} widget={widget} onSettled={onSettled} />
        return <ProposalCard key={proposal.id} proposal={proposal} />
      })}
    </div>
  )
}

function ProposalCard({ proposal }: { proposal: AdminProposalCard }) {
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setPending(true)
    setError(null)
    const saved = await confirmAdminProposal(proposal.id)
    setPending(false)
    if (saved.error) {
      setError(saved.error)
      return
    }
    setResult(saved.verified ?? "Saved.")
  }

  async function cancel() {
    setPending(true)
    setError(null)
    const cancelled = await cancelAdminProposal(proposal.id)
    setPending(false)
    if (cancelled.error) {
      setError(cancelled.error)
      return
    }
    setResult("Cancelled. Nothing was saved.")
  }

  return (
    <article className="rounded-2xl bg-[#f6f1e6] px-4 py-3 text-sm text-[#2b2433]">
      <p className="text-xs font-medium tracking-wide text-[#6d5c4a]">Confirm before saving</p>
      <p className="mt-1 leading-6">{proposal.summary}</p>
      {error ? <p className="mt-2 text-[#8a2f2f]">{error}</p> : null}
      {result ? <p className="mt-2">{result}</p> : null}
      {result ? null : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={pending}
            className="rounded-full bg-[#2a2436] px-3 py-1.5 text-[#f6f1e6] disabled:opacity-40"
            onClick={() => void confirm()}
          >
            Confirm
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-full px-3 py-1.5 underline disabled:opacity-40"
            onClick={() => void cancel()}
          >
            Cancel
          </button>
        </div>
      )}
    </article>
  )
}
