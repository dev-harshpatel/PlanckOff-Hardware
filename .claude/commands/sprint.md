# /sprint — Sprint Planning & Execution

You are executing the `/sprint` command. Your job is to plan and execute a focused sprint of work on this project.

---

## Step 1: Identify the Sprint Goal

If the user specified a focus in `$ARGUMENTS`, use that. Otherwise, read:
1. `WORKING_HOURS_ESTIMATION.md` — what's the highest priority incomplete work?
2. `.claude/memory/MEMORY.md` — what was left pending from last session?
3. Ask the user: "What's the most important thing to finish this sprint?"

**Sprint constraints:**
- A sprint = one focused Claude Code session
- Estimate: 2–4 concrete deliverables per session
- Always finish Phase 0/1 work before Phase 2+ work

---

## Step 2: List Tasks for This Sprint

Generate a concrete, ordered list. Format:

```
SPRINT GOAL: [One sentence]
ESTIMATED WORK: [X hours from WORKING_HOURS_ESTIMATION.md]

Tasks (in execution order):
1. [Task] — [File(s) to create/modify] — [Est. time]
2. [Task] — [File(s) to create/modify] — [Est. time]
3. [Task] — [File(s) to create/modify] — [Est. time]

Out of scope for this sprint:
- [What we're explicitly NOT doing today]
```

Get user confirmation before starting.

---

## Step 3: Execute Tasks

For each task:
1. Read the relevant files first — never modify code you haven't read
2. Make targeted changes — don't refactor adjacent code unless it's directly required
3. After each task, verify it works (type check, or describe how to test it)
4. Mark the task complete before starting the next one

**Pause points:** After each task, say "Task 1 complete. Moving to Task 2 — [description]. OK?"

---

## Step 4: End of Sprint Summary

When all tasks are done (or session is ending), produce:

```
SPRINT COMPLETE

Completed:
✅ [Task 1] — [files modified]
✅ [Task 2] — [files modified]

Partially done:
⏳ [Task 3] — [what's done, what's left]

Not started:
❌ [Task 4]

Key decisions made:
- [Decision 1 and why]
- [Decision 2 and why]

Next sprint should start with:
- [Next task in order]
- [Any blockers to resolve]
```

Then auto-run `/checkpoint` to save to memory.

---

## Sprint Priorities (Reference)

Always execute in this order. Don't skip ahead.

| Sprint | Focus | Prerequisite |
|---|---|---|
| 1 | Phase 0 + Phase 1.1 (Real auth) | None |
| 2 | Phase 1.2 (API key proxy) | Sprint 1 done |
| 3 | Phase 1.3 (Supabase DB migration) | Sprint 2 done |
| 4 | Phase 2.1–2.3 (PDF pipeline: triage + queue + stitching) | Phase 1.2 done |
| 5 | Phase 2.4–2.8 (Checkpoint, worker pool, vision fallback) | Sprint 4 done |
| 6 | Phase 3–4 (Performance + code quality) | Phase 2 done |
| 7 | Phase 5–6 (Testing + UX) | Phase 3-4 done |

---

## Execution Rules During Sprint

- Read files before modifying — no blind edits
- One concern per file change — don't reformat a whole file while fixing a bug
- If a task takes longer than estimated, flag it before continuing
- If you encounter an unexpected dependency (e.g., Auth needs to be done before X), stop and flag it
- Don't add "nice to have" improvements outside the sprint scope
- If you hit a blocker, describe it clearly and ask the user how to proceed
