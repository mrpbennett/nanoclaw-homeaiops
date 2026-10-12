import { describe, it, expect } from 'vitest';

import { suppressThreadCreation } from './discord.js';

describe('suppressThreadCreation', () => {
  it('makes the adapter’s createDiscordThread reject so no thread is opened', async () => {
    const adapter = { createDiscordThread: async () => ({ id: 'new-thread' }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    suppressThreadCreation(adapter as any);
    await expect(adapter.createDiscordThread()).rejects.toThrow('thread creation disabled');
  });
});
