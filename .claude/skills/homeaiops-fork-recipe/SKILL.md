---
name: homeaiops-fork-recipe
description: The single source of truth for how this Home AIOps fork differs from upstream NanoClaw, and how to keep it mergeable. Use before and after /update-nanoclaw, when asked what we changed from upstream, when adding any new customization, or when rebuilding the fork from clean upstream.
---

# Home AIOps fork recipe

This fork is upstream [`nanocoai/nanoclaw`](https://github.com/nanocoai/nanoclaw)
plus a short, audited list of deviations. Nothing counts as part of the fork
until it is listed here and reproducible from a skill (see
[skills-model.md](../../../docs/skills-model.md)).

- **Baseline**: upstream `main` at `ab09973a` (v2026.10.0 line), 2026-10-12.
- **Remotes**: `origin` = this fork; `upstream` = `https://github.com/nanocoai/nanoclaw.git`.
- **Audit**: `.claude/skills/homeaiops-fork-recipe/audit.sh` — read-only; exits non-zero if a deviation is undocumented, a patch has been lost, or the README merge policy is not configured.

## Deviations

| # | Deviation | Kind | Reproduce with | Guard |
|---|-----------|------|----------------|-------|
| 1 | OneCLI credential gateway | Stock skill, **no local edits** | `/add-onecli` | upstream's own `onecli*.test.ts` |
| 2 | Discord channel | Stock skill, **no local edits** | `/add-discord` | `discord-registration.test.ts` |
| 3 | No auto-created Discord threads; button clicks resolve to the right option | Patch skill | `/homeaiops-discord-patches` | `discord-local.test.ts`, `discord-local-bridge.test.ts` |
| 4 | Home AIOps `README.md` (+ `.gitattributes`, `merge.ours.driver`) | Fork-owned file | restore from this fork's `origin/main`; set merge policy (below) | `audit.sh` |
| 5 | Agent groups, wirings, `.env`, `groups/` | Runtime state, **not in git** | see "Runtime state" | `ncl` listings |

Rows 1 and 2 matter only because they change `package.json`, `pnpm-lock.yaml`,
`src/channels/index.ts` and `src/gateway-providers/installed.ts` — the files most
likely to conflict. The pinned dependencies they add are `@onecli-sh/sdk@2.2.1`
and `@chat-adapter/discord@4.29.0`.

### README

Upstream edits `README.md` often (16 commits since July 2026), so a rewritten
README conflicts on nearly every update. `.gitattributes` marks it `merge=ours`,
and the repo-local git config supplies the driver. One-time setup per clone
(`git config` is not carried by `git clone`):

```bash
git config merge.ours.driver true
```

Without the driver git falls back to an ordinary conflict, so it fails safe.
`README_ja/ko/zh.md` are untouched and follow upstream.

### Runtime state (row 5)

Gitignored and per-install; the update transaction snapshots it
(`.env`, `data/`, `groups/`) and restores it on failure. Never commit it. Current
state, in the order it was created:

| Item | State | Recreate with |
|------|-------|---------------|
| Agent group `MooMoo` (`groups/dm-with-paul`) | Stock first-agent scaffold, model `claude-sonnet-5-5`, `cli_scope: global` | `/init-first-agent` |
| Wiring: Discord DM → MooMoo | engage `pattern` `.` (every message), `shared` session | `/init-first-agent` |
| Wiring: one Discord server channel → MooMoo | engage `mention`, `shared` session | `/manage-channels` |
| `.env` keys | `DISCORD_BOT_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`, `NANOCLAW_GATEWAY_PROVIDER` (+ OneCLI's) — names only; the Discord values are secrets, never commit `.env`. Upstream credentials for agents go through the gateway, not `.env` | `/add-discord`, `/add-onecli` |

Inspect: `bin/ncl groups list`, `bin/ncl wirings list`, `bin/ncl groups config get --id <id>`.

The three Home AIOps agents in `README.md` are planned, not yet created. When one
is created, add a row above: name, folder, wirings, mounts, `container.json`
packages and MCP servers, and the `ncl`/skill commands that recreate it. Keep
agent-specific instructions in `groups/<folder>/instructions.prepend.md`, never
in a file upstream owns.

## Routine update

Always `/update-nanoclaw`, never `git pull` (the repo `CLAUDE.md` banner explains
why). Before: run `audit.sh` and fix anything red, so the transaction starts from a
known-good fork. After cutover: run it again.

What to expect from a merge, and what to do (resolve inside the staged worktree):

| File | Expectation | Resolution |
|------|-------------|------------|
| `README.md` | never conflicts (`merge=ours`) | — |
| `package.json`, `pnpm-lock.yaml` | conflicts when upstream bumps deps | take upstream's side, then re-add the two pins above and `pnpm install` (lockfile is regenerated, never hand-merged) |
| `src/channels/index.ts`, `src/gateway-providers/installed.ts` | one appended import each; conflicts only if upstream appends at the same spot | keep both lines |
| `src/channels/discord.ts` | the validate step **re-copies it from the `channels` branch**, dropping our 2-line reach-in | run `/homeaiops-discord-patches` step 2; `discord-local.test.ts` goes red until you do |
| `src/channels/chat-sdk-bridge.ts` | conflicts if upstream edits `handleForwardedEvent` | take upstream's side, re-apply `/homeaiops-discord-patches` step 3 (or drop it if upstream fixed the bug) |
| anything else | should never conflict — we do not edit it | investigate: a stray edit means a missing skill |

## Rebuild from clean upstream

Use when the fork has fallen far behind, or to hand it to someone else.

1. Clone upstream at the target tag; `git remote add origin <this fork>`.
2. `git config merge.ours.driver true`; restore `.gitattributes` and `README.md` from `origin/main`.
3. `/add-onecli`, then `/add-discord` (setup commits each as `setup: apply <skill>`).
4. `/homeaiops-discord-patches`.
5. Restore `.claude/skills/homeaiops-*` from `origin/main`.
6. Recreate runtime state (table above), then `audit.sh`, `pnpm run build`, `pnpm test`.

## Adding a new customization

1. Prefer a skill that **adds** files. Put logic in a fork-owned file; keep any edit to an upstream-owned file to an import and a call.
2. Add a test that goes red if the reach-in is lost or drifts (build/typecheck for typed imports; a behaviour test for runtime wiring) — see [skill-guidelines.md](../../../docs/skill-guidelines.md).
3. Put it in a skill under `.claude/skills/homeaiops-*` (bundle small related patches into one, like `homeaiops-discord-patches`) with a `REMOVE.md` if apply leaves anything behind.
4. Add its paths to `expected-deviations.txt` and a row to the table above.
5. `audit.sh` must pass before the commit. A change that cannot be expressed this way is a candidate to upstream as a PR instead.

## Candidates to upstream

- Discord `custom_id` `"\n<value>"` suffix strip in `chat-sdk-bridge.ts` — an upstream bug. Merging it removes a deviation.
- Option to suppress Discord thread creation for wirings with threads off — would remove `discord-local.ts`.
