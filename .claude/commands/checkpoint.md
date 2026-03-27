# /checkpoint — Save Current Context to Memory

You are executing the `/checkpoint` command. Your job is to capture the current session state into persistent memory so it survives context compaction or session end.

---

## When This Is Called

The user runs `/checkpoint` when:
- They're about to start a long task and want the current state saved first
- They feel the context window getting large
- They're ending a session and want progress saved
- The system auto-triggers it via `PreCompact` hook

---

## What You Must Do

Execute ALL of the following steps in order. Do not skip any.

### Step 1 — Summarize What Was Done This Session

Write a concise summary of:
- What tasks were completed
- What files were created or modified (with file paths)
- What decisions were made (and why)
- What was left incomplete or deferred
- Any blockers encountered

### Step 2 — Write to Memory File

Save the summary to the memory system. Determine whether to create a new memory file or update an existing one.

Check the memory index at:
`/Users/harsh/.claude/projects/-Users-harsh-harsh-work-Projects-PlanckOff-Planckoff--hardware-estimating/memory/MEMORY.md`

Then write the session progress as a `project` type memory. Name the file `project_session_YYYY-MM-DD.md` using today's date.

Memory file format:
```markdown
---
name: Session Progress YYYY-MM-DD
description: What was completed, modified, and left pending in this session
type: project
---

## Completed This Session
[List of completed tasks with file paths]

## Decisions Made
[Key architectural or implementation decisions with rationale]

## Files Modified
[List of files created/modified]

## Left Pending / Next Steps
[What needs to happen next, in order]

## Blockers
[Anything that needs user input or external dependencies]

**Why:** Preserve session context across compaction or session restart.
**How to apply:** Read this at the start of the next session to pick up where we left off.
```

### Step 3 — Update MEMORY.md Index

Add an entry for the new memory file in MEMORY.md.

### Step 4 — Confirm to User

Tell the user:
- What was saved
- The memory file path
- What the next session should start with

---

## Example Output

```
Checkpoint saved.

Completed this session:
- Implemented PreCompact hook in settings.local.json
- Created /checkpoint, /pdf-pipeline, /auth commands
- Updated WORKING_HOURS_ESTIMATION.md with revised Phase 2 estimate

Next session should start by:
- Reading memory/project_session_2026-03-27.md
- Continuing with Phase 1.1 (Supabase Auth implementation)
- File to start with: contexts/AuthContext.tsx

Saved to: memory/project_session_2026-03-27.md
```
