import { AccessDeniedError } from './acl.js';
import { getSupabase } from './supabase.js';

export async function assertTranscriptRelinkAllowed(transcriptId: string): Promise<void> {
  const supabase = getSupabase();
  const { data: classification, error } = await supabase
    .from('transcript_classification')
    .select('visibility')
    .eq('transcript_id', transcriptId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load transcript classification: ${error.message}`);
  }

  if (classification?.visibility === 'private') {
    throw new AccessDeniedError('Private transcripts cannot be relinked');
  }
}
