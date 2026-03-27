# Multi-Agent Orchestration Guide — PlanckOff

## What Multi-Agent Means in Claude Code

Claude Code can spawn **subagents** — independent Claude instances that work on tasks in parallel or sequence. The main session orchestrates; subagents execute.

**When to use subagents:**
- Tasks that are truly independent (different files, different features)
- Long research tasks that would eat the main context window
- Running tests while continuing to write code
- Validating work after it's done

**When NOT to use subagents:**
- Tasks that depend on each other's output
- Simple single-file edits
- When the context window is already well-used (subagents start fresh)

---

## Agent Types Available in This Project

Claude Code has these built-in agent types:

| Type | Use For |
|---|---|
| `general-purpose` | Complex research, multi-step implementation |
| `Explore` | Fast codebase search and analysis |
| `Plan` | Architecture planning before coding |

---

## Multi-Agent Patterns for This Project

### Pattern 1: Parallel Feature Development

Use when two features are completely independent (different files, different domains).

**Example: Auth + PDF Pipeline simultaneously**

```
Main Session (orchestrator):
  ├── Spawns Agent A in worktree: /auth command → implements Phase 1.1
  └── Spawns Agent B in worktree: /pdf-pipeline command → implements Phase 2.1

Both agents work in isolated git worktrees.
Main session merges when both complete.
```

**How to trigger:**
"Please spawn two parallel agents: one to work on auth (Phase 1.1) following the /auth command, and one to build the PDF page triage function (Phase 2.1). Use isolated worktrees."

---

### Pattern 2: Research + Implement

Use when you need to understand the codebase before making changes.

```
Agent 1 (Explore): "Read all files in services/ and contexts/ and tell me every place
                    where localStorage is read or written, with file path and line number"

Main Session: Receives the audit → plans the migration → implements

(Agent 1 doesn't modify files — just researches)
```

**Example prompt for research agent:**
"Use the Explore agent to find every localStorage.getItem and localStorage.setItem call in the codebase. Return: file path, line number, what key is being accessed."

---

### Pattern 3: Implement + Validate

Use when you want to write code and have a separate agent verify it.

```
Main Session: Implements a new service function

Background Agent: Runs type checks and tests after each file is written
                  Returns: "3 type errors in geminiService.ts at lines 45, 67, 89"

Main Session: Fixes errors without re-reading everything
```

---

### Pattern 4: Sprint Decomposition

For a large sprint, decompose into parallel work streams:

```
Sprint Goal: Implement Phase 1 (Auth + API Proxy + DB Schema)

Stream A (Main session):
  - Supabase auth setup (contexts/AuthContext.tsx)
  - Login/logout pages
  - Middleware

Stream B (Background agent, isolated worktree):
  - API route scaffold (app/api/ai/generate/route.ts)
  - Remove API keys from client bundle
  - Update aiProviderService.ts

Stream C (Background agent, isolated worktree):
  - Write DB schema SQL migrations
  - Write RLS policies
  - Write migration utility

All streams merge into main branch when complete.
```

---

## Feature-Specific Agent Assignments

### For Phase 1 (Security & Auth)

**Recommended agent split:**

| Agent | Task | Files |
|---|---|---|
| Main | Auth implementation (AuthContext, login pages, middleware) | `contexts/AuthContext.tsx`, `app/(auth)/login/`, `middleware.ts` |
| Background A | API key proxy (Next.js API routes) | `app/api/ai/generate/route.ts`, `services/aiProviderService.ts` |
| Background B | DB schema + migrations | `supabase/migrations/`, RLS policies |

---

### For Phase 2 (PDF Pipeline)

**Recommended agent split:**

| Agent | Task | Files |
|---|---|---|
| Main | AsyncQueue implementation + wire into fileUploadService | `services/fileUploadService.ts`, `utils/asyncQueue.ts` |
| Background A | Page triage function (classifyPage) + tests | `utils/pdfTriage.ts`, `utils/pdfTriage.test.ts` |
| Background B | Checkpoint/resume with IndexedDB | `utils/pdfCheckpoint.ts` |
| Research | Scan all PDF-related files for the double-chunking bug | Read-only exploration |

---

### For Phase 5 (Testing)

Tests are highly parallelizable — each test file is independent:

| Agent | Tests For |
|---|---|
| Agent 1 | `services/pricing/` — all pricing calculations |
| Agent 2 | `utils/parsers/csvParser` + `xlsxParser` |
| Agent 3 | `utils/validation/doorValidation` |
| Agent 4 | `utils/pdfTriage` + PDF pipeline functions |
| Main | Integrate all, fix conflicts, run full suite |

---

## How to Prompt for Multi-Agent Work

### Spawning a parallel research agent:

```
"Use the Explore subagent to search the entire codebase for [specific thing].
Return [specific output format]. Do not modify any files."
```

### Spawning a parallel implementation agent (isolated):

```
"Spawn an agent with isolation: worktree to implement [task].
The agent should follow the /[command] instructions.
Target files: [list].
When done, return a summary of what was created and what still needs wiring."
```

### Running tests in background:

```
"In the background, run all tests in services/ and return the results.
I'll continue working on [other task] while that runs."
```

---

## Worktree Isolation — When to Use It

Use `isolation: worktree` when:
- The agent will MODIFY files (not just read)
- The work is parallel to your main session
- You want to review the agent's changes before merging

**Without worktree:** Agent works in your main directory. Changes are immediate. Use for read-only research.
**With worktree:** Agent works in a copy. Changes are isolated. You merge when satisfied.

---

## Orchestration Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | Instead |
|---|---|---|
| Spawning agents for simple tasks | Overhead exceeds benefit | Do it in main session |
| Two agents modifying the same file | Race conditions, conflicts | Assign one file to one agent |
| Agent chain where output feeds next without review | Errors compound | Review each agent output before feeding next |
| Spawning an agent for a 5-minute task | Context switch cost too high | Just do it |
| Not giving agents the right command context | Agent won't follow project standards | Always reference `/command` in agent prompt |

---

## Context Flow in Multi-Agent Work

```
User
 │
 └──► Main Session (orchestrator)
        │
        ├──► Reads CLAUDE.md (project context)
        ├──► Reads MEMORY.md (session history)
        │
        ├──► Agent A (isolated worktree)
        │       ├── Reads CLAUDE.md ← same project rules
        │       ├── Executes task
        │       └── Returns summary + file paths
        │
        └──► Agent B (isolated worktree)
                ├── Reads CLAUDE.md ← same project rules
                ├── Executes task
                └── Returns summary + file paths

Main session merges + saves checkpoint
```

**Key insight:** Because `CLAUDE.md` is always loaded, every agent automatically follows the same architecture rules, code standards, and constraints — you don't need to repeat them in every agent prompt.

---

## Practical Example: Starting Phase 1 with Multiple Agents

```
You: "Start Sprint 1. Use parallel agents for Phase 1.1 and 1.2."

Claude (orchestrator):
  1. Plans the split:
     - Agent A: Phase 1.1 (auth) in worktree branch 'feat/auth'
     - Agent B: Phase 1.2 (API proxy) in worktree branch 'feat/api-proxy'

  2. Briefs each agent with:
     - Task description referencing /auth or /pdf-pipeline command
     - Files to create/modify
     - Output format (what to return when done)

  3. Receives results from both agents
  4. Reviews diffs from each worktree
  5. Merges both branches
  6. Runs /checkpoint
  7. Reports to you: "Both tasks complete. Here's what was done..."
```
