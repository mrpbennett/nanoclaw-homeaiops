/**
 * Home AIOps: thread-creation suppression on the Discord channel.
 *
 * Two legs. The function itself, and — the part that goes red when an upstream
 * refresh of `add-discord` re-copies discord.ts and drops our two-line
 * reach-in — the real discord.ts factory handing a suppressed adapter to the
 * bridge. Only the external edge (the SDK adapter, the bridge, env) is faked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { suppressThreadCreation } from './discord-local.js';

const mocks = vi.hoisted(() => ({
  registration: undefined as undefined | { factory: () => unknown },
  bridgeArgs: undefined as undefined | { adapter: { createDiscordThread: () => Promise<unknown> } },
  sdkAdapter: {
    createDiscordThread: async () => ({ id: 'new-thread' }),
    handleForwardedMessage: async () => {},
  },
}));

vi.mock('./channel-registry.js', () => ({
  registerChannelAdapter: (_name: string, registration: { factory: () => unknown }) => {
    mocks.registration = registration;
  },
}));
vi.mock('./chat-sdk-bridge.js', () => ({
  createChatSdkBridge: (args: { adapter: { createDiscordThread: () => Promise<unknown> } }) => {
    mocks.bridgeArgs = args;
    return { name: 'discord' };
  },
}));
vi.mock('@chat-adapter/discord', () => ({ createDiscordAdapter: () => mocks.sdkAdapter }));
vi.mock('../env.js', () => ({
  readEnvFile: () => ({ DISCORD_BOT_TOKEN: 't', DISCORD_PUBLIC_KEY: 'k', DISCORD_APPLICATION_ID: 'a' }),
}));

describe('suppressThreadCreation', () => {
  it("makes the adapter's createDiscordThread reject so no thread is opened", async () => {
    const adapter = { createDiscordThread: async () => ({ id: 'new-thread' }) };
    suppressThreadCreation(adapter);
    await expect(adapter.createDiscordThread()).rejects.toThrow('thread creation disabled');
  });
});

describe('discord.ts wiring', () => {
  beforeEach(() => {
    mocks.bridgeArgs = undefined;
  });

  it('hands the bridge an adapter whose thread creation is suppressed', async () => {
    await import('./discord.js');
    expect(mocks.registration).toBeDefined();
    mocks.registration!.factory();
    expect(mocks.bridgeArgs).toBeDefined();
    await expect(mocks.bridgeArgs!.adapter.createDiscordThread()).rejects.toThrow('thread creation disabled');
  });
});
