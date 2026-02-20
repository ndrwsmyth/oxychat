import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { Hono } from 'hono';
import { webhooksRouter } from '../webhooks.js';
import { runTaskToCompletion } from '@ndrwsmyth/sediment';
import { createIngestRuntime } from '../../lib/runtime.js';

vi.mock('@ndrwsmyth/sediment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ndrwsmyth/sediment')>();
  return {
    ...actual,
    runTaskToCompletion: vi.fn(),
  };
});

vi.mock('../../lib/runtime.js', () => ({
  createIngestRuntime: vi.fn(),
}));

vi.mock('../../adapters/transcript-sources.js', () => ({
  createCirclebackSource: vi.fn(() => ({ sourceName: 'circleback', transform: vi.fn() })),
}));

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

describe('webhook retry semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CIRCLEBACK_WEBHOOK_SECRET = 'test-secret';
    vi.mocked(createIngestRuntime).mockReturnValue({
      getDeps: () => ({}),
      getRequestId: () => 'req-1',
    } as never);
  });

  it('returns 400 for invalid JSON payloads after signature verification', async () => {
    const app = new Hono();
    app.route('/api/webhooks', webhooksRouter);

    const rawBody = '{"invalid":';
    const response = await app.request('/api/webhooks/transcripts', {
      method: 'POST',
      headers: {
        'x-signature': sign(rawBody, 'test-secret'),
      },
      body: rawBody,
    });

    expect(response.status).toBe(400);
  });

  it('returns deterministic success payload with retryable=false on duplicate-safe ingest', async () => {
    vi.mocked(runTaskToCompletion).mockResolvedValue({
      transcriptId: 'transcript-1',
      isNew: false,
    });

    const app = new Hono();
    app.route('/api/webhooks', webhooksRouter);

    const rawBody = JSON.stringify({
      id: 10,
      name: 'Client Sync',
      createdAt: '2026-02-19T10:00:00Z',
      duration: 120,
      attendees: [{ name: 'Member', email: 'member@oxy.so' }],
      transcript: [{ speaker: 'Member', text: 'hello', timestamp: 1 }],
    });

    const response = await app.request('/api/webhooks/transcripts', {
      method: 'POST',
      headers: {
        'x-signature': sign(rawBody, 'test-secret'),
      },
      body: rawBody,
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      success: boolean;
      transcript_id: string;
      is_new: boolean;
      retryable: boolean;
    };
    expect(body.success).toBe(true);
    expect(body.transcript_id).toBe('transcript-1');
    expect(body.is_new).toBe(false);
    expect(body.retryable).toBe(false);
  });
});
