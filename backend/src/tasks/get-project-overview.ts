import { defineTask } from '@ndrwsmyth/sediment';
import { getSupabase } from '../lib/supabase.js';

export interface ProjectOverviewData {
  projectId: string;
  overviewMarkdown?: string;
}

/**
 * Loads project overview markdown by explicit project id.
 * Ownership/access checks happen upstream in the pipeline layer.
 */
export const getProjectOverviewTask = defineTask<
  { projectId: string },
  ProjectOverviewData
>('get_project_overview', async function* (input) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('projects')
    .select('id, overview_markdown')
    .eq('id', input.projectId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load project overview: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Project not found: ${input.projectId}`);
  }

  const overviewMarkdown =
    typeof data.overview_markdown === 'string' && data.overview_markdown.trim()
      ? data.overview_markdown
      : undefined;

  yield {
    projectId: data.id,
    overviewMarkdown,
  };
});
