---
name: homeaiops-discord-patches
description: Re-apply the Home AIOps fork's local Discord behaviour changes (no auto-created threads on @mention; button clicks resolve to the right option). Use after /add-discord is applied or refreshed, after /update-nanoclaw reports a Discord or chat-sdk-bridge conflict or a failing discord-local test, or when rebuilding the fork from clean upstream.
---

# Home AIOps Discord patches

Two small behaviour changes on top of the stock Discord channel. Both live in
skill-owned files plus the smallest possible reach-in; the canonical copies are
under this skill's `payload/` and `patches/`.

Apply after `/add-discord`. Re-run after every `/add-discord` refresh: the
refresh re-copies `src/channels/discord.ts` from the `channels` branch, which
drops the reach-in in step 2. Every step is safe to re-run.

## What changes and why

| Change | Why | Where |
|--------|-----|-------|
| `suppressThreadCreation` | `@chat-adapter/discord` opens a "Thread <timestamp>" off every top-level @mention regardless of the wiring's thread policy. With threads off, that thread is empty and replies land top-level, so the thread is noise. Throwing from `createDiscordThread` is non-fatal in the adapter: it falls back to the channel as the thread id. | `src/channels/discord-local.ts` (new) + 2 lines in `src/channels/discord.ts` |
| Strip `"\n<value>"` from button `custom_id` | The adapter encodes a valued button as `<actionId>\n<value>`. The bridge parsed the tail as `0\n0`, which never resolves to a real option, so clicking an `ask_user_question` option picked nothing. | 13-line edit in `src/channels/chat-sdk-bridge.ts` (`handleForwardedEvent`) |

The second change fixes an upstream bug. Candidate to send upstream as a PR; once
it lands in a release, delete `patches/bridge-custom-id.patch`, the bridge test,
and this row.

## Apply

### 1. Copy the skill-owned files

```bash
cp .claude/skills/homeaiops-discord-patches/payload/src/channels/* src/channels/
```

This installs `discord-local.ts`, `discord-local.test.ts` (the function and the
`discord.ts` wiring) and `discord-local-bridge.test.ts` (the bridge fix, driven
through the real bridge).

### 2. Wire `discord.ts` (re-apply after every `/add-discord` refresh)

Skip if already applied; the check succeeds when the patch is present:

```bash
p=.claude/skills/homeaiops-discord-patches/patches
git apply --reverse --check $p/discord-reach-in.patch 2>/dev/null || git apply $p/discord-reach-in.patch
```

If `git apply` fails because upstream moved the surrounding lines, make the same
two edits by hand in `src/channels/discord.ts`:

```typescript
import { suppressThreadCreation } from './discord-local.js';   // with the other imports
// ...inside the registerChannelAdapter('discord', { factory }) body,
// directly after unwrapForwards(discordAdapter):
suppressThreadCreation(discordAdapter);
```

### 3. Patch the bridge

```bash
git apply --reverse --check $p/bridge-custom-id.patch 2>/dev/null || git apply $p/bridge-custom-id.patch
```

If it no longer applies, find where `handleForwardedEvent` reads
`interaction.data.custom_id` for `ncq:` buttons, and parse
`customId?.split('\n')[0]` instead of `customId`. The test in step 4 states the
required behaviour. If upstream fixed this itself, drop the patch (see above).

### 4. Build and validate

```bash
pnpm run build
pnpm exec vitest run src/channels/discord-local.test.ts src/channels/discord-local-bridge.test.ts
.claude/skills/homeaiops-fork-recipe/audit.sh
```

## Integration points and their guards

| Reach-in | Guard | Goes red when |
|----------|-------|---------------|
| `suppressThreadCreation(...)` call in `discord.ts` | `discord-local.test.ts` › "discord.ts wiring": runs the real factory, asserts the adapter given to the bridge rejects `createDiscordThread` | an `/add-discord` refresh re-copies `discord.ts`, or the call drifts |
| `./discord-local.js` import in `discord.ts` | `pnpm run build` | the import is deleted but the call remains, or `discord-local.ts` is missing |
| `custom_id` suffix strip in `chat-sdk-bridge.ts` | `discord-local-bridge.test.ts`: posts `ncq:q-2:0\n0` through the real bridge's loopback webhook, expects option `0` | the strip is dropped by an upstream merge |

`chat-sdk-bridge.test.ts` is deliberately left identical to upstream: the bridge
test lives in `discord-local-bridge.test.ts` so an upstream edit to the trunk test
file never conflicts.

## Troubleshooting

- **`/update-nanoclaw` validate fails on `discord-local.test.ts`**: the refresh re-copied `discord.ts`. Run step 2 inside the staged worktree, commit, and re-run validate.
- **Merge conflict in `chat-sdk-bridge.ts`**: take upstream's side of the hunk, then run step 3. If upstream now splits on `\n` itself, delete the patch and its test instead.
- **A thread still appears on @mention**: check `createDiscordThread` still exists in `node_modules/@chat-adapter/discord/dist/index.js` after an adapter bump. If it was renamed, update `discord-local.ts` and its test.
