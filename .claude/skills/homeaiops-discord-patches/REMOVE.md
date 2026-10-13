# Remove the Home AIOps Discord patches

Every step is idempotent — safe to re-run.

## 1. Revert the reach-ins

```bash
p=.claude/skills/homeaiops-discord-patches/patches
git apply --reverse $p/discord-reach-in.patch 2>/dev/null || true
git apply --reverse $p/bridge-custom-id.patch 2>/dev/null || true
```

If a patch does not reverse cleanly, remove by hand: the `./discord-local.js`
import and the `suppressThreadCreation(discordAdapter);` call in
`src/channels/discord.ts`, and the `\n`-suffix strip in
`src/channels/chat-sdk-bridge.ts` (parse `customId` directly again).

## 2. Delete the copied files

```bash
rm -f src/channels/discord-local.ts src/channels/discord-local.test.ts src/channels/discord-local-bridge.test.ts
```

## 3. Update the recipe

Delete the `src/channels/discord-local…` and `chat-sdk-bridge.ts` lines from
`.claude/skills/homeaiops-fork-recipe/expected-deviations.txt`, and the patch
skill's row from the recipe's inventory.

## 4. Rebuild

```bash
pnpm run build && pnpm exec vitest run src/channels
```
