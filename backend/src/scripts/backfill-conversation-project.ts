import 'dotenv/config';
import { getSupabase } from '../lib/supabase.js';
import { ensurePersonalWorkspace } from '../lib/workspace-bootstrap.js';

function parseBatchSize(): number {
  const argIndex = process.argv.findIndex((arg) => arg === '--batch-size');
  if (argIndex === -1) return 200;
  const raw = process.argv[argIndex + 1];
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid --batch-size value: ${raw}`);
  }
  return parsed;
}

async function main() {
  const supabase = getSupabase();
  const batchSize = parseBatchSize();

  let totalUpdated = 0;
  let iterations = 0;

  while (true) {
    iterations += 1;

    const { data: batch, error: batchError } = await supabase
      .from('conversations')
      .select('id, user_id')
      .is('project_id', null)
      .order('created_at', { ascending: true })
      .limit(batchSize);

    if (batchError) {
      throw new Error(`Failed to fetch backfill batch: ${batchError.message}`);
    }

    if (!batch || batch.length === 0) {
      break;
    }

    const userIds = [...new Set(batch.map((row) => row.user_id))];

    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, email')
      .in('id', userIds);

    if (usersError) {
      throw new Error(`Failed to load user profiles: ${usersError.message}`);
    }

    const emailByUserId = new Map((users ?? []).map((row) => [row.id, row.email]));
    const workspaceByUserId = new Map<string, string>();

    for (const userId of userIds) {
      const email = emailByUserId.get(userId) ?? `user+${userId}@oxy.so`;
      const workspace = await ensurePersonalWorkspace(userId, email);
      workspaceByUserId.set(userId, workspace.projectId);
    }

    for (const row of batch) {
      const projectId = workspaceByUserId.get(row.user_id);
      if (!projectId) continue;

      const { error: updateError } = await supabase
        .from('conversations')
        .update({ project_id: projectId })
        .eq('id', row.id)
        .is('project_id', null);

      if (updateError) {
        throw new Error(`Failed to update conversation ${row.id}: ${updateError.message}`);
      }

      totalUpdated += 1;
    }

    console.log(
      `[backfill:conversation-project] Iteration ${iterations} processed ${batch.length} row(s)`
    );

    if (batch.length < batchSize) {
      break;
    }
  }

  console.log(`[backfill:conversation-project] Updated ${totalUpdated} conversation(s)`);
}

main().catch((error) => {
  console.error('[backfill:conversation-project] Failed:', error);
  process.exitCode = 1;
});
