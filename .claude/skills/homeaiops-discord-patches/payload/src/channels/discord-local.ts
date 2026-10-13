/**
 * Home AIOps local Discord behaviour. Fork-owned: installed by the
 * `homeaiops-discord-patches` skill, never overwritten by an upstream refresh
 * of the `add-discord` payload. `discord.ts` calls into this file.
 */

/**
 * The adapter opens a "Thread <timestamp>" off every top-level @mention before
 * the message reaches us, regardless of the wiring's thread policy. With
 * threads off on a wiring that thread is empty — replies land top-level — so
 * stop it being created. The adapter treats a failed create as non-fatal
 * (logs, then falls back to the channel as the thread id), so throwing here
 * leaves the mention in the channel.
 */
export function suppressThreadCreation(adapter: object): void {
  const a = adapter as { createDiscordThread: (channelId: string, messageId: string) => Promise<unknown> };
  a.createDiscordThread = async () => {
    throw new Error('thread creation disabled');
  };
}
