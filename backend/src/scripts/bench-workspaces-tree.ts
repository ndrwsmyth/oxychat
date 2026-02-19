import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getSupabase } from '../lib/supabase.js';
import { buildWorkspaceTree } from '../lib/workspaces.js';

const BENCH_ADMIN_USER_ID = process.env.BENCH_ADMIN_USER_ID ?? '00000000-0000-0000-0000-0000000000a1';
const BENCH_ADMIN_EMAIL = process.env.BENCH_ADMIN_EMAIL ?? 'admin@oxy.so';

function idFor(prefix: string, index: number): string {
  return `${prefix}-0000-0000-0000-${String(index).padStart(12, '0')}`;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function ensureBenchData() {
  const supabase = getSupabase();
  const now = new Date().toISOString();

  await supabase.from('user_profiles').upsert(
    {
      id: BENCH_ADMIN_USER_ID,
      email: BENCH_ADMIN_EMAIL,
      clerk_id: 'bench_admin',
      full_name: 'Bench Admin',
      updated_at: now,
    },
    { onConflict: 'id' }
  );

  await supabase.from('user_roles').upsert(
    {
      user_id: BENCH_ADMIN_USER_ID,
      role: 'admin',
      updated_at: now,
    },
    { onConflict: 'user_id' }
  );

  const clients = Array.from({ length: 50 }, (_, index) => {
    const ordinal = index + 1;
    return {
      id: idFor('50000000', ordinal),
      name: `Bench Client ${String(ordinal).padStart(3, '0')}`,
      scope: 'client' as const,
      updated_at: now,
    };
  });

  const { error: clientsError } = await supabase.from('clients').upsert(clients, { onConflict: 'id' });
  if (clientsError) {
    throw new Error(`Failed to seed bench clients: ${clientsError.message}`);
  }

  const projects = Array.from({ length: 200 }, (_, index) => {
    const ordinal = index + 1;
    const clientIndex = (index % 50) + 1;
    return {
      id: idFor('60000000', ordinal),
      client_id: idFor('50000000', clientIndex),
      name: `Bench Project ${String(ordinal).padStart(3, '0')}`,
      scope: 'client' as const,
      is_inbox: index % 10 === 0,
      updated_at: now,
    };
  });

  const { error: projectsError } = await supabase
    .from('projects')
    .upsert(projects, { onConflict: 'id' });

  if (projectsError) {
    throw new Error(`Failed to seed bench projects: ${projectsError.message}`);
  }

  const conversations = Array.from({ length: 600 }, (_, index) => {
    const ordinal = index + 1;
    const projectIndex = (index % 200) + 1;
    return {
      id: idFor('70000000', ordinal),
      user_id: BENCH_ADMIN_USER_ID,
      project_id: idFor('60000000', projectIndex),
      title: `Bench Conversation ${String(ordinal).padStart(3, '0')}`,
      model: 'claude-sonnet-4-6',
      updated_at: now,
    };
  });

  const { error: conversationsError } = await supabase
    .from('conversations')
    .upsert(conversations, { onConflict: 'id' });

  if (conversationsError) {
    throw new Error(`Failed to seed bench conversations: ${conversationsError.message}`);
  }
}

async function writeReport(samplesMs: number[]): Promise<void> {
  const p50 = percentile(samplesMs, 50);
  const p95 = percentile(samplesMs, 95);
  const targetMs = 250;
  const status = p95 < targetMs ? 'PASS' : 'WARN';

  const report = `# S1 Workspace Tree Baseline\n\n- Generated at: ${new Date().toISOString()}\n- Samples: ${samplesMs.length}\n- P50: ${p50.toFixed(2)}ms\n- P95: ${p95.toFixed(2)}ms\n- Target: < ${targetMs}ms\n- Status: ${status}\n`;

  const reportPath = path.resolve(process.cwd(), '..', 'docs', 'prd_dev', 'perf', 's1_workspace_tree_baseline.md');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, report, 'utf-8');
}

async function main() {
  await ensureBenchData();

  // Warm-up
  for (let i = 0; i < 5; i += 1) {
    await buildWorkspaceTree(BENCH_ADMIN_USER_ID);
  }

  const samplesMs: number[] = [];
  for (let i = 0; i < 20; i += 1) {
    const start = performance.now();
    await buildWorkspaceTree(BENCH_ADMIN_USER_ID);
    samplesMs.push(performance.now() - start);
  }

  await writeReport(samplesMs);

  const p95 = percentile(samplesMs, 95);
  console.log(`[bench:workspaces-tree] p95=${p95.toFixed(2)}ms over ${samplesMs.length} runs`);
}

main().catch((error) => {
  console.error('[bench:workspaces-tree] Failed:', error);
  process.exitCode = 1;
});
