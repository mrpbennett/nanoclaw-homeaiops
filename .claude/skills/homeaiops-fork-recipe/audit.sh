#!/usr/bin/env bash
# Audit this fork against upstream. Read-only. Exit 0 = every deviation is
# documented and every guard is intact; exit 1 = something needs attention.
#   usage: audit.sh [upstream-remote]   (default: upstream)
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
remote="${1:-upstream}"
ref="$remote/main"
recipe=.claude/skills/homeaiops-fork-recipe
patches=.claude/skills/homeaiops-discord-patches
fail=0
say() { printf '%s\n' "$*"; }

git rev-parse --verify -q "$ref" >/dev/null || { say "FAIL no $ref — run: git remote add upstream https://github.com/nanocoai/nanoclaw.git && git fetch upstream"; exit 1; }

# 1. README merge policy configured (otherwise README conflicts on every update)
if [ "$(git config --get merge.ours.driver || true)" = "true" ] && grep -q '^README.md merge=ours' .gitattributes 2>/dev/null; then
  say "ok   README merge policy (.gitattributes + merge.ours.driver)"
else
  say "FAIL README merge policy missing — run: git config merge.ours.driver true  (and keep 'README.md merge=ours' in .gitattributes)"; fail=1
fi

# 2. Every changed path is a documented deviation
base="$(git merge-base HEAD "$ref")"
changed="$( { git diff --name-only "$base"; git ls-files -o --exclude-standard; } | sort -u )"
patterns="$(grep -Ev '^\s*(#|$)' "$recipe/expected-deviations.txt")"
unexpected="$(printf '%s\n' "$changed" | grep -Ev -f <(printf '%s\n' "$patterns") | grep -v '^$' || true)"
if [ -z "$unexpected" ]; then
  say "ok   all $(printf '%s\n' "$changed" | grep -c .) changed paths are documented deviations"
else
  say "FAIL undocumented deviations from $ref (document in SKILL.md + expected-deviations.txt, or move into a skill):"
  printf '       %s\n' $unexpected; fail=1
fi

# 3. Patch-skill payload matches the live copies
while IFS= read -r f; do
  live="${f#"$patches/payload/"}"
  if cmp -s "$f" "$live"; then say "ok   $live matches payload"; else say "FAIL $live differs from $f (payload is canonical — copy it over, or update the payload)"; fail=1; fi
done < <(find "$patches/payload" -type f | sort)

# 4. Trunk/skill-refreshed reach-ins are present (patch is applied iff it reverses cleanly)
for p in "$patches"/patches/*.patch; do
  if git apply --reverse --check "$p" 2>/dev/null; then say "ok   $(basename "$p") applied"; else say "FAIL $(basename "$p") not applied — see $patches/SKILL.md"; fail=1; fi
done

[ "$fail" = 0 ] && say "AUDIT PASSED" || say "AUDIT FAILED"
exit "$fail"
