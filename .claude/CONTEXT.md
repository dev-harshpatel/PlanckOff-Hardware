# Context Window Management Guide

## How Context Works in Claude Code

Claude Code has a context window limit. As the conversation grows (files read, code written, responses exchanged), the context fills up. When it gets close to the limit, Claude Code automatically **compacts** — it summarizes prior conversation to free up space.

**The problem:** After compaction, Claude loses the detailed memory of what it was doing. It retains a summary, but specific decisions, file paths, and in-progress work may be lost.

**The solution:** The memory system + `/checkpoint` command + hooks.

---

## The 80% Rule

**Don't wait for compaction to save state. Save proactively.**

Signs the context window is getting full:
- You've been working for a long time in one session
- You've read many large files
- You've had long back-and-forth exchanges

When you notice this, immediately run `/checkpoint` before continuing.

---

## How Context Management Works in This Project

### Layer 1: CLAUDE.md (Always Loaded)
`CLAUDE.md` in the project root is loaded into every new session automatically. It contains:
- What the project is
- Current phase and priorities
- Critical constraints
- Key file locations
- Available commands

This means every session starts with the same baseline knowledge.

### Layer 2: Memory Files (Explicitly Loaded)
Memory files in `/Users/harsh/.claude/projects/.../memory/` are NOT automatically loaded — they must be recalled. They store:
- Session progress (what was done, what's next)
- Key decisions made
- Feedback and preferences

At the start of each session, Claude should check MEMORY.md for recent session notes.

### Layer 3: `/checkpoint` Command (Manual Save)
Run `/checkpoint` to explicitly save the current state to memory. Use this:
- At the end of every work session
- Before starting a risky or complex task
- When you feel the context is getting large
- Before switching to a different feature area

### Layer 4: `PreCompact` Hook (Automatic Trigger)
When the context window reaches its compaction threshold, the `PreCompact` hook fires and logs to `memory/compaction-log.md`. This is a signal — not a full save. After compaction, Claude should be prompted to run `/checkpoint` to document what was happening before the compaction.

### Layer 5: `Stop` Hook (Activity Log)
After every response, a timestamp is written to `memory/session-activity.log`. This creates an audit trail of session activity.

---

## Recommended Session Workflow

### Session Start
```
1. Claude reads CLAUDE.md automatically
2. You ask: "What was left from last session?"
3. Claude checks MEMORY.md and the most recent session_YYYY-MM-DD.md
4. Claude orients on the current state and proposed next steps
5. You confirm or redirect
```

### During a Session
```
- Work in focused sprints (use /sprint command)
- After completing a major task, run /checkpoint
- If context feels full, run /checkpoint immediately
- For long tasks, checkpoint at milestones (not just at the end)
```

### Session End
```
1. Run /checkpoint (saves everything to memory)
2. Claude outputs: what was done, what's next, any blockers
3. You can close the session safely
```

### After Compaction (automatic)
```
When Claude Code compacts, it shows a "Context has been compressed" notice.
After this notice, run /checkpoint to save the post-compaction state.
Then continue working — Claude has the summary + the memory files.
```

---

## What Gets Saved to Memory

| Type | Content | File |
|---|---|---|
| Project state | Phase, active tasks, pending decisions | `memory/project_session_YYYY-MM-DD.md` |
| Feedback | What to do / not do in future | `memory/feedback_*.md` |
| Architecture decisions | Why something was built a certain way | `memory/project_decisions.md` |
| Blockers | What's waiting on external input | `memory/project_session_*.md` |

### What Does NOT Get Saved
- Code itself (that's in the files)
- Git history (use `git log`)
- Transient debugging steps

---

## Multi-Session Work Patterns

### Pattern A: Feature Work Across Sessions
```
Session 1: Plan + start auth implementation → /checkpoint
Session 2: Read MEMORY.md → continue auth → /checkpoint
Session 3: Read MEMORY.md → finish auth + start API proxy → /checkpoint
```

### Pattern B: Parallel Feature Development (Multi-Agent)
```
Agent 1 (main session): Works on auth implementation
Agent 2 (background): Works on PDF pipeline tests
Both agents write to memory when done
Main session merges results
```

### Pattern C: Long Single-Feature Session
```
Work → /checkpoint every 45 min or after each major task
If compaction fires → run /checkpoint immediately after
Continue with fresh context
```

---

## Commands Reference

| Command | When to Use |
|---|---|
| `/checkpoint` | Save current state to memory (run this often) |
| `/sprint` | Plan a focused set of tasks, execute them, auto-checkpoint at end |
| `/architecture` | When making structural decisions (saves rationale) |

---

## Files in the Memory System

```
memory/
├── MEMORY.md                      # Index of all memory files
├── session-activity.log           # Auto-updated by Stop hook (timestamps)
├── compaction-log.md              # Auto-updated by PreCompact hook
├── project_session_YYYY-MM-DD.md  # Per-session progress (from /checkpoint)
├── feedback_*.md                  # User preferences and corrections
└── project_decisions.md           # Key architectural decisions
```
