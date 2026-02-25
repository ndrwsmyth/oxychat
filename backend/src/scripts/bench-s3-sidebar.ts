import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getSupabase } from '../lib/supabase.js';
import { buildWorkspaceTree } from '../lib/workspaces.js';

const DATASET_CLIENTS = 50;
const DATASET_PROJECTS = 200;
const DATASET_CONVERSATIONS = 2000;
const SAMPLES = 20;
const TARGET_QUERY_P95_MS = 250;
const TARGET_RENDER_P95_MS = 120;
const DELETE_CHUNK_SIZE = 200;

const BENCH_ADMIN_USER_ID = process.env.BENCH_ADMIN_USER_ID ?? '00000000-0000-0000-0000-0000000000a1';
const BENCH_ADMIN_EMAIL = process.env.BENCH_ADMIN_EMAIL ?? 'admin@oxy.so';

interface BenchConversation {
  id: string;
  title: string;
  project_id: string;
  pinned: boolean;
  updated_at: string;
}

function idFor(prefix: string, index: number): string {
  return `${prefix}-0000-0000-0000-${String(index).padStart(12, '0')}`;
}

function buildBenchIds(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_unused, index) => idFor(prefix, index + 1));
}

const BENCH_CLIENT_IDS = buildBenchIds('51000000', DATASET_CLIENTS);
const BENCH_PROJECT_IDS = buildBenchIds('61000000', DATASET_PROJECTS);
const BENCH_CONVERSATION_IDS = buildBenchIds('71000000', DATASET_CONVERSATIONS);

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function assertRequiredEnv(): void {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'] as const;
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars for bench:s3-sidebar: ${missing.join(', ')}. Set them before running the benchmark.`
    );
  }
}

async function deleteRowsByIds(
  table: 'conversations' | 'projects' | 'clients',
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  const supabase = getSupabase();

  for (let start = 0; start < ids.length; start += DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(start, start + DELETE_CHUNK_SIZE);
    const { error } = await supabase.from(table).delete().in('id', chunk);
    if (error) {
      throw new Error(`Failed to cleanup ${table} bench rows: ${error.message}`);
    }
  }
}

async function cleanupBenchData(): Promise<void> {
  // Delete in FK-safe order.
  await deleteRowsByIds('conversations', BENCH_CONVERSATION_IDS);
  await deleteRowsByIds('projects', BENCH_PROJECT_IDS);
  await deleteRowsByIds('clients', BENCH_CLIENT_IDS);
}

async function ensureBenchData(): Promise<BenchConversation[]> {
  const supabase = getSupabase();
  const now = new Date();
  const nowIso = now.toISOString();

  await supabase.from('user_profiles').upsert(
    {
      id: BENCH_ADMIN_USER_ID,
      email: BENCH_ADMIN_EMAIL,
      clerk_id: 'bench_admin_s3',
      full_name: 'Bench Admin S3',
      updated_at: nowIso,
    },
    { onConflict: 'id' }
  );

  await supabase.from('user_roles').upsert(
    {
      user_id: BENCH_ADMIN_USER_ID,
      role: 'admin',
      updated_at: nowIso,
    },
    { onConflict: 'user_id' }
  );

  const clients = Array.from({ length: DATASET_CLIENTS }, (_unused, index) => {
    const ordinal = index + 1;
    return {
      id: idFor('51000000', ordinal),
      name: `S3 Bench Client ${String(ordinal).padStart(3, '0')}`,
      scope: 'client' as const,
      updated_at: nowIso,
    };
  });

  const { error: clientsError } = await supabase.from('clients').upsert(clients, { onConflict: 'id' });
  if (clientsError) {
    throw new Error(`Failed to seed S3 bench clients: ${clientsError.message}`);
  }

  const projects = Array.from({ length: DATASET_PROJECTS }, (_unused, index) => {
    const ordinal = index + 1;
    const clientIndex = (index % DATASET_CLIENTS) + 1;
    return {
      id: idFor('61000000', ordinal),
      client_id: idFor('51000000', clientIndex),
      name: `S3 Bench Project ${String(ordinal).padStart(3, '0')}`,
      scope: 'client' as const,
      is_inbox: ordinal % 15 === 0,
      updated_at: nowIso,
    };
  });

  const { error: projectsError } = await supabase.from('projects').upsert(projects, { onConflict: 'id' });
  if (projectsError) {
    throw new Error(`Failed to seed S3 bench projects: ${projectsError.message}`);
  }

  const conversations: BenchConversation[] = Array.from({ length: DATASET_CONVERSATIONS }, (_unused, index) => {
    const ordinal = index + 1;
    const projectIndex = (index % DATASET_PROJECTS) + 1;
    const updatedAt = new Date(now.getTime() - (index % 20) * 60_000).toISOString();
    return {
      id: idFor('71000000', ordinal),
      title: `S3 Bench Conversation ${String(ordinal).padStart(4, '0')}`,
      project_id: idFor('61000000', projectIndex),
      pinned: ordinal % 25 === 0,
      updated_at: updatedAt,
    };
  });

  const { error: conversationsError } = await supabase.from('conversations').upsert(
    conversations.map((conversation) => ({
      ...conversation,
      user_id: BENCH_ADMIN_USER_ID,
      model: 'gpt-5.2',
    })),
    { onConflict: 'id' }
  );

  if (conversationsError) {
    throw new Error(`Failed to seed S3 bench conversations: ${conversationsError.message}`);
  }

  return conversations;
}

function buildSidebarRenderView(
  workspaceTree: Awaited<ReturnType<typeof buildWorkspaceTree>>,
  conversations: BenchConversation[]
) {
  const projectPathById = new Map<string, { clientName: string; projectName: string }>();
  for (const client of workspaceTree) {
    for (const project of client.projects) {
      projectPathById.set(project.id, {
        clientName: client.name,
        projectName: project.name,
      });
    }
  }

  const grouped = {
    pinned: 0,
    today: 0,
    yesterday: 0,
    older: 0,
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86_400_000);

  const scopedConversations = conversations.filter((conversation) => projectPathById.has(conversation.project_id));
  for (const conversation of scopedConversations) {
    if (conversation.pinned) {
      grouped.pinned += 1;
      continue;
    }
    const updatedAt = new Date(conversation.updated_at);
    if (updatedAt >= today) grouped.today += 1;
    else if (updatedAt >= yesterday) grouped.yesterday += 1;
    else grouped.older += 1;
  }

  return {
    grouped,
    projectCount: projectPathById.size,
    conversationCount: scopedConversations.length,
  };
}

async function writeReport(querySamples: number[], renderSamples: number[]): Promise<void> {
  const queryP50 = percentile(querySamples, 50);
  const queryP95 = percentile(querySamples, 95);
  const renderP50 = percentile(renderSamples, 50);
  const renderP95 = percentile(renderSamples, 95);
  const status =
    queryP95 < TARGET_QUERY_P95_MS && renderP95 < TARGET_RENDER_P95_MS ? 'PASS' : 'FAIL';

  const report = `# S3 Sidebar Baseline

- Generated at: ${new Date().toISOString()}
- Dataset: ${DATASET_CLIENTS} clients, ${DATASET_PROJECTS} projects, ${DATASET_CONVERSATIONS} conversations
- Samples: ${SAMPLES}
- Query P50: ${queryP50.toFixed(2)}ms
- Query P95: ${queryP95.toFixed(2)}ms
- Render P50: ${renderP50.toFixed(2)}ms
- Render P95: ${renderP95.toFixed(2)}ms
- Query target: < ${TARGET_QUERY_P95_MS}ms
- Render target: < ${TARGET_RENDER_P95_MS}ms
- Status: ${status}
`;

  const reportPath = path.resolve(process.cwd(), '..', 'docs', 'prd_dev', 'perf', 's3_sidebar_baseline.md');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, report, 'utf-8');
}

async function main() {
  assertRequiredEnv();
  await cleanupBenchData();

  try {
    const conversations = await ensureBenchData();

    // Warm-up
    for (let i = 0; i < 5; i += 1) {
      const tree = await buildWorkspaceTree(BENCH_ADMIN_USER_ID);
      buildSidebarRenderView(tree, conversations);
    }

    const querySamples: number[] = [];
    const renderSamples: number[] = [];

    for (let i = 0; i < SAMPLES; i += 1) {
      const queryStart = performance.now();
      const tree = await buildWorkspaceTree(BENCH_ADMIN_USER_ID);
      querySamples.push(performance.now() - queryStart);

      const renderStart = performance.now();
      buildSidebarRenderView(tree, conversations);
      renderSamples.push(performance.now() - renderStart);
    }

    await writeReport(querySamples, renderSamples);

    const queryP95 = percentile(querySamples, 95);
    const renderP95 = percentile(renderSamples, 95);

    console.log(
      `[bench:s3-sidebar] query_p95=${queryP95.toFixed(2)}ms render_p95=${renderP95.toFixed(2)}ms samples=${SAMPLES}`
    );

    if (queryP95 >= TARGET_QUERY_P95_MS || renderP95 >= TARGET_RENDER_P95_MS) {
      throw new Error(
        `S3 sidebar baseline above target (query_p95=${queryP95.toFixed(2)}ms render_p95=${renderP95.toFixed(2)}ms)`
      );
    }
  } finally {
    await cleanupBenchData();
  }
}

main().catch((error) => {
  console.error('[bench:s3-sidebar] Failed:', error);
  process.exitCode = 1;
});
