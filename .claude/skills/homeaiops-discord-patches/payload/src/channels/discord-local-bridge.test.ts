/**
 * Home AIOps: the Chat SDK bridge must strip the "\n<value>" suffix that
 * @chat-adapter/discord appends to a button custom_id. Drives the real bridge
 * through its loopback Gateway webhook, so it goes red if the inline fix in
 * chat-sdk-bridge.ts is dropped or drifts (e.g. after an upstream merge).
 * Kept apart from chat-sdk-bridge.test.ts so that trunk test file stays
 * identical to upstream.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Adapter } from 'chat';

import { createChatSdkBridge } from './chat-sdk-bridge.js';

vi.mock('../webhook-server.js', () => ({
  registerWebhookAdapter: vi.fn(),
}));

const BOT_TOKEN = 'test-bot-token';
const realFetch = globalThis.fetch;

async function startGateway() {
  let webhookUrl = '';
  const adapter = {
    name: 'discord',
    initialize: async () => {},
    handleWebhook: vi.fn(async () => new Response('ok')),
    channelIdFromThreadId: (threadId: string) => threadId,
    startGatewayListener: async (_opts: unknown, _ms: number, _signal: AbortSignal, url: string) => {
      webhookUrl = url;
      return new Response('{}');
    },
  } as unknown as Adapter;
  const onAction = vi.fn();
  const bridge = createChatSdkBridge({ adapter, supportsThreads: true, botToken: BOT_TOKEN });
  await bridge.setup({ onInbound: () => {}, onInboundEvent: () => {}, onMetadata: () => {}, onAction });
  const post = (body: string) =>
    realFetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-discord-gateway-token': BOT_TOKEN },
      body,
    });
  return { bridge, post, onAction };
}

describe('createChatSdkBridge — Discord button custom_id', () => {
  beforeEach(async () => {
    const { initTestDb } = await import('../db/connection.js');
    const { runMigrations } = await import('../db/migrations/index.js');
    await runMigrations(await initTestDb());
    // Interaction acks go to the Discord API; keep them off the network.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    const { closeDb } = await import('../db/connection.js');
    await closeDb();
  });

  it('strips the adapter "\\n<value>" suffix from a button custom_id', async () => {
    const { bridge, post, onAction } = await startGateway();
    try {
      // @chat-adapter/discord encodes custom_id as "<actionId>\n<value>".
      const indexed = JSON.stringify({
        type: 'GATEWAY_INTERACTION_CREATE',
        data: {
          type: 3,
          id: 'interaction-2',
          token: 'interaction-token',
          channel_id: 'chan-1',
          data: { custom_id: 'ncq:q-2:0\n0' },
          member: { user: { id: 'clicker-1', username: 'clicker' } },
          message: { id: 'card-2', embeds: [] },
        },
      });
      expect((await post(indexed)).status).toBe(200);
      // No render row exists for q-2, so the index passes through unresolved —
      // the point is that it is "0", not "0\n0".
      expect(onAction).toHaveBeenCalledWith('q-2', '0', 'clicker-1', {
        messageId: 'card-2',
        platformId: 'chan-1',
      });
    } finally {
      await bridge.teardown();
    }
  });
});
