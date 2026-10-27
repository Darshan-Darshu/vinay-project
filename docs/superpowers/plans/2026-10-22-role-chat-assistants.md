# Role chat assistants implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four role assistants with tool-holding subagents, exam marks, and searchable PDF passages, as specified in `docs/superpowers/specs/2026-10-22-role-chat-assistants-design.md`.

**Architecture:** Pure functions decide exam rows, passage splits, search rank, step limits, and the guest tool list. Security-definer SQL saves exam marks and chat lines. The Vercel AI SDK `generateText` loop calls a smaller assistant, and only that smaller assistant holds data tools.

**Tech Stack:** Next.js 16, existing Supabase server client, `ai`, `@ai-sdk/google`, `@ai-sdk/openai`, Zod 4, `node:test`.

## Global Constraints

- Public model failure sentence: `We couldn't generate a response right now. Please try again.`
- Parent step limit 4. Smaller-assistant step limit 6.
- Message max 2000 characters. Model sees the newest 20 messages.
- Guest transcripts are not stored and guest calls are not written to `ai_usage_logs`.
- Exam maximum is 1 through 100. Score is 0 through the maximum.
- Passages are at most 1200 characters. Search returns at most 5.
- Embeddings: `gemini-embedding-001` or `text-embedding-3-small`.
- Question tools store `source = manual`.
- Publishing a paper, deleting a person, submitting a quiz, uploading a PDF, uploading a resume, starting an interview, and explaining a placement match have no tool.

## Tasks

- [ ] Pure checks for exam rows, CSV, passages, rank, step limit, and the guest tool list.
- [ ] Migration for exam marks, passages, quiz-score reads, and one-transaction chat save.
- [ ] Exam marks form and CSV on `/teacher/exam-marks` and `/admin/exam-marks`.
- [ ] Prepare a stored PDF into passages and search them by role.
- [ ] Assistant pages for admin, teacher, and student, plus an unsaved guest box on `/guest`.
- [ ] `npm test` and `npx tsc --noEmit`.
