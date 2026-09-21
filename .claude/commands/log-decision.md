---
description: Append a dated entry to the Decisions log in CLAUDE.md
argument-hint: [what was decided, optional]
allowed-tools: Read, Edit, Bash(date:*), Bash(git diff:*), Bash(git log:*)
---

Append one entry to the **Decisions** section of `CLAUDE.md` for: $ARGUMENTS

If no argument was given, work out what to log by reading `git diff` and the recent
`git log`, then propose the entry before writing it.

## Does it qualify?

Log it if a future session, seeing only the code, would not know **why** — and might
undo it. Concretely, log it when the change:

- picks one option over a named alternative (a library, a layout, a pattern),
- exists to prevent a specific failure that is not obvious from the code,
- sets a convention later code is expected to follow,
- or narrows something the assignment left open.

Do **not** log routine work: a feature built the way the rules already prescribe, a
bug fix with no design content, formatting, or anything already stated elsewhere in
`CLAUDE.md` or `.claude/rules/`. An over-full log stops being read, which costs more
than a missing line.

## Format

One bullet at the **end** of the Decisions list, never rewriting existing entries:

```
- YYYY-MM-DD — <the decision, stated as a fact in the present tense>. <One clause of
  why.> <Optional: the instruction that stops it being undone.>
```

Use today's real date from `date +%F`, not a guess. Keep it to two or three lines.
Where a decision protects against something, say what breaks without it — that clause
is the whole reason the entry exists. For example: "Do not simplify this back to
explicit imports."

## After writing

Say in one line what you logged. Stage `CLAUDE.md` alongside the change it describes so
the decision and the code land in the same commit.
