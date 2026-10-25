# Placement AI Check

One button on the student placement page. A fixed coordinator runs four agents and returns one object. The existing "Fits your skills" list stays.

## Behavior

On `/student/placement`, **AI Check** sits above the current skill list. That list still loads typed skills on the page and still offers "Why this fits" per drive.

The button calls a student server action. The action does not write `student_resumes`, drives, or applications. The result exists only in the click response.

The coordinator always runs the resume agent, the skills agent, and the job-fetch agent, then the match agent. Skills and job fetch are code. Resume and match call `generateJson`. A missing model, a provider error, or JSON that fails validation is handled per agent below. Usage rows do not store the prompt or the completion.

## Agents

**Resume.** Download the signed-in student's PDF from the `resumes` bucket and read it with `extractPdfText`. Send at most 12,000 characters. The model returns extracted skills and a short summary. Code trims and lowercases skills, drops any skill longer than 40 characters, and keeps at most 40. No PDF, unreadable text, or a failed model call yields an empty extracted-skill list and a notice. Typed skills still run. Extracted skills are not saved onto the resume row.

**Skills.** Read `student_resumes.skills` for this student. No model.

**Job fetch.** Every `placement_drives` row with `status = open` and `deleted_at` null. Department and course do not filter the list. Each drive keeps id, company, role, required skills, eligibility, package, location, and a description clipped to 400 characters.

**Match.** Receives typed skills, extracted skills, the resume summary, and the drives. Code unions the two skill lists. For every drive it computes shared skills, missing skills, and `overlapPercent = round(shared / required * 100)`. A drive with no required skills has overlap 0. The model returns, per drive, `modelScore` from 0 to 100, a short reason, and cited skills. A cited skill must be in the combined skill list or that drive's required skills. A bad citation or an unknown drive id drops that drive's model fields and keeps the overlap.

## Result

A drive is shown when overlap is above 0 or `modelScore` is 40 or above. **High chance** means `modelScore >= 70`. Sort by high chance, then fit score, then overlap, then company name.

```ts
type PlacementCheckResult = {
  notice: string | null
  typedSkills: string[]
  extractedSkills: string[]
  matches: {
    id: string
    companyName: string
    roleTitle: string
    shared: string[]
    missing: string[]
    overlapPercent: number
    modelScore: number | null
    highChance: boolean
    reason: string | null
  }[]
}
```

If the student has no typed skills and no readable resume text, the action returns an error and does not call a model. A PDF that yields no text counts as no resume. If match generation fails, the action still returns overlap rows for drives that share a skill, with `modelScore` null and a notice. Resume and match each write an `ai_usage_logs` row, with feature names `placement_resume` and `placement_match`.

## Screen

The button uses the same panel style as the other academic AI forms. The pending label is "Checking…". Each result card shows company, role, overlap percent, fit score, a High chance label when true, shared skills, missing skills, and the reason. The card is rendered only on the student placement module.

## Tests

Overlap percentage, the 70 cutoff, citation rejection, and joining a match-agent object onto drives are pure functions. Those tests do not call a model. The placement page is checked in the browser: the button is present, the existing skill list remains, and a student with no skills and no resume gets the error without a model call.
