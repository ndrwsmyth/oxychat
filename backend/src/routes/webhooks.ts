import { createHmac, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { runTaskToCompletion } from '@ndrwsmyth/sediment';
import { ingestTranscriptTask } from '../tasks/ingest-transcript.js';
import {
  createCirclebackSource,
  type CirclebackPayload,
} from '../adapters/transcript-sources.js';
import { createIngestRuntime } from '../lib/runtime.js';

export const webhooksRouter = new Hono();

function verifySignature(body: string, signature: string, secret: string): boolean {
  const computed = createHmac('sha256', secret).update(body).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
  } catch {
    return false;
  }
}

webhooksRouter.post('/transcripts', async (c) => {
  // 1. Validate webhook signature
  const signature = c.req.header('X-Signature');
  const secret = process.env.CIRCLEBACK_WEBHOOK_SECRET;

  if (!secret || !signature) {
    console.warn('[webhook] Missing secret or signature');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const rawBody = await c.req.text();

  if (!verifySignature(rawBody, signature, secret)) {
    console.warn('[webhook] Invalid signature');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // 2. Parse payload
  const payload = JSON.parse(rawBody) as CirclebackPayload;

  // 3. Validate payload has transcript
  if (!payload.transcript || payload.transcript.length === 0) {
    console.warn('[webhook] Empty transcript received, skipping');
    return c.json({ success: true, skipped: true });
  }

  // 4. Run ingestion task
  const runtime = createIngestRuntime();
  const deps = runtime.getDeps();
  const source = createCirclebackSource();

  try {
    const result = await runTaskToCompletion(
      ingestTranscriptTask,
      { source, payload },
      deps
    );

    if (!result) {
      throw new Error('Ingestion task returned no result');
    }

    return c.json({
      success: true,
      transcript_id: result.transcriptId,
      is_new: result.isNew,
    });
  } catch (err) {
    console.error('[webhook] Ingestion failed:', err);
    return c.json({ error: 'Ingestion failed' }, 500);
  }
});
