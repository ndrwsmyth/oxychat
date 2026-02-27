import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { chatAgentTask } from '../tasks/chat-agent.js';
import { createChatRuntime } from '../lib/runtime.js';
import { MODEL_CONFIG, type ModelKey } from '../lib/constants.js';
import { assertAnyEnvVar, assertRequiredEnvVars, assertSupabaseServiceRoleKey } from './lib/preflight.js';

const SAMPLES = 8;
const WARMUP_SAMPLES = 1;
const TARGET_FIRST_TOKEN_P95_MS = 1600;
const DEFAULT_POLICY = 'warn-with-owner';
const POLICY_OWNER = process.env.S4_CHAT_LATENCY_OWNER ?? 'platform-owner';

type EnforcementPolicy = 'warn-with-owner' | 'hard-fail';

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function resolvePolicy(): EnforcementPolicy {
  const raw = (process.env.S4_CHAT_LATENCY_POLICY ?? DEFAULT_POLICY).trim().toLowerCase();
  if (raw === 'hard-fail') return 'hard-fail';
  return 'warn-with-owner';
}

function resolveModel(): ModelKey {
  const requested = (process.env.BENCH_S4_CHAT_MODEL ?? '').trim() as ModelKey | '';
  if (requested) {
    if (!MODEL_CONFIG[requested]) {
      throw new Error(`Unknown BENCH_S4_CHAT_MODEL: ${requested}`);
    }
    const provider = MODEL_CONFIG[requested].provider;
    if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
      throw new Error(`Model ${requested} requires ANTHROPIC_API_KEY`);
    }
    if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
      throw new Error(`Model ${requested} requires OPENAI_API_KEY`);
    }
    return requested;
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return 'claude-sonnet-4-6';
  }
  if (process.env.OPENAI_API_KEY) {
    return 'gpt-5.2';
  }
  throw new Error('Missing ANTHROPIC_API_KEY or OPENAI_API_KEY');
}

async function sampleFirstTokenLatency(model: ModelKey, sampleIndex: number): Promise<number> {
  const runtime = createChatRuntime({
    model,
    conversationId: `bench-s4-chat-latency-${sampleIndex}`,
  });
  const deps = runtime.getDeps();

  const startedAt = performance.now();
  let firstTokenLatency: number | null = null;

  for await (const chunk of chatAgentTask.execute(
    {
      model,
      conversationMessages: [],
      userContent: 'Reply with exactly one token: ACK',
      mentionIds: [],
      projectOverviewMarkdown:
        'Project benchmark overview: prioritize deterministic prompt assembly and low-latency first-token delivery.',
      userContext: 'Current user benchmark context: focus on concise response generation.',
    },
    deps
  )) {
    if (chunk.type === 'token') {
      firstTokenLatency = performance.now() - startedAt;
      break;
    }
  }

  if (firstTokenLatency === null) {
    throw new Error('No token received from chat agent benchmark sample');
  }

  return firstTokenLatency;
}

async function writeReport(
  model: ModelKey,
  samples: number[],
  policy: EnforcementPolicy,
  status: 'PASS' | 'WARN' | 'FAIL'
): Promise<void> {
  const p50 = percentile(samples, 50);
  const p95 = percentile(samples, 95);

  const report = `# S4 Chat Latency Baseline

- Generated at: ${new Date().toISOString()}
- Model: ${model}
- Samples: ${samples.length}
- First token P50: ${p50.toFixed(2)}ms
- First token P95: ${p95.toFixed(2)}ms
- Target: < ${TARGET_FIRST_TOKEN_P95_MS}ms
- Policy: ${policy}
- Owner: ${POLICY_OWNER}
- Status: ${status}
`;

  const reportPath = path.resolve(
    process.cwd(),
    '..',
    'docs',
    'prd_dev',
    'perf',
    's4_chat_latency_baseline.md'
  );
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, report, 'utf-8');
}

async function main() {
  assertRequiredEnvVars('bench:s4-chat-latency', ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']);
  assertSupabaseServiceRoleKey('bench:s4-chat-latency');
  assertAnyEnvVar('bench:s4-chat-latency', ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY']);

  const model = resolveModel();
  const policy = resolvePolicy();

  for (let i = 0; i < WARMUP_SAMPLES; i += 1) {
    await sampleFirstTokenLatency(model, i);
  }

  const samples: number[] = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    samples.push(await sampleFirstTokenLatency(model, i + WARMUP_SAMPLES));
  }

  const p95 = percentile(samples, 95);
  let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  if (p95 >= TARGET_FIRST_TOKEN_P95_MS) {
    status = policy === 'hard-fail' ? 'FAIL' : 'WARN';
  }

  await writeReport(model, samples, policy, status);
  console.log(`[bench:s4-chat-latency] first_token_p95=${p95.toFixed(2)}ms policy=${policy} status=${status}`);

  if (status === 'WARN') {
    console.warn(`[bench:s4-chat-latency] WARN owner=${POLICY_OWNER}`);
  }

  if (status === 'FAIL') {
    throw new Error(`S4 chat latency benchmark above target (first_token_p95=${p95.toFixed(2)}ms)`);
  }
}

main().catch((error) => {
  console.error('[bench:s4-chat-latency] Failed:', error);
  process.exitCode = 1;
});
