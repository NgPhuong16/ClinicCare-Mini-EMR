#!/usr/bin/env bash
# Fires before `git commit`. If the commit changes something architecture-bearing but
# CLAUDE.md is not part of it, remind both Claude and the human to consider a Decisions
# entry. It never blocks the commit — a hook people disable is worth nothing.
#
# Deliberately dependency-free: no jq, no python. Only bash and git.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# `git commit -am` stages at commit time, so look at both staged and unstaged tracked work.
changed=$(
  {
    git diff --cached --name-only
    git diff --name-only
  } 2>/dev/null | sort -u
)
[ -z "$changed" ] && exit 0

# Already logging something — nothing to nag about.
if grep -qx "CLAUDE.md" <<<"$changed"; then
  exit 0
fi

# A brand-new module is where conventions get set.
new_modules=$(git diff --cached --name-status 2>/dev/null |
  grep '^A' | cut -f2 |
  grep -E '^(backend/app/|frontend/(composables|components|pages|types)/)' |
  grep -vE '(__init__\.py|\.test\.|\.spec\.)' || true)

# Files where a change is almost always a convention or dependency call.
load_bearing=$(grep -E '^(backend/app/core/|backend/app/main\.py$|backend/migrations/env\.py$|backend/pyproject\.toml$|frontend/nuxt\.config\.ts$|frontend/package\.json$)' <<<"$changed" || true)

[ -z "$new_modules" ] && [ -z "$load_bearing" ] && exit 0

trigger=$(printf '%s\n%s' "$new_modules" "$load_bearing" | grep -v '^$' | head -4 | tr '\n' ' ')

msg="This commit touches ${trigger}but CLAUDE.md is not staged. If it settled a convention, a tradeoff, or a constraint that a future session would otherwise re-litigate, append one dated line to the Decisions section first (see /log-decision). Routine work needs no entry — say so and move on."

printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"%s","systemMessage":"Decisions check: %s"}}\n' \
  "$msg" "CLAUDE.md not staged alongside ${trigger}"

exit 0
