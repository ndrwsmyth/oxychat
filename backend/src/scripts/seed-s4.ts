import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getSupabase } from '../lib/supabase.js';
import { extractEmailDomain, isInternalDomain } from '../lib/transcript-normalization.js';
import { assertRequiredEnvVars } from './lib/preflight.js';

interface ProjectOverviewFixture {
  project_id: string;
  overview_markdown: string | null;
}

interface TranscriptFixture {
  id: string;
  source_id: string;
  title: string;
  content: string;
  summary: string | null;
  date: string;
  raw_json: unknown;
  attendees: Array<{ email: string; name: string | null }>;
  classification: null | {
    visibility: 'private' | 'non_private';
    classification_reason:
      | 'weekly_exception'
      | 'external_attendee'
      | 'internal_attendees_only'
      | 'no_attendees';
    is_weekly_exception: boolean;
  };
  link: null | {
    project_id: string;
    link_source: 'domain_match' | 'title_alias' | 'client_inbox_fallback' | 'global_triage_fallback';
  };
}

interface SeedFixture {
  project_overviews: ProjectOverviewFixture[];
  transcripts: TranscriptFixture[];
}

function runSeedS3(): void {
  const result = spawnSync('pnpm', ['run', 'seed:s3'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error('seed:s3 failed');
  }
}

async function loadFixture(): Promise<SeedFixture> {
  const fixturePath = path.resolve(process.cwd(), 'seeds', 's4.fixture.json');
  const raw = await fs.readFile(fixturePath, 'utf-8');
  return JSON.parse(raw) as SeedFixture;
}

async function seedProjectOverviews(
  fixture: SeedFixture,
  now: string
): Promise<void> {
  const supabase = getSupabase();
  for (const projectOverview of fixture.project_overviews) {
    const { error } = await supabase
      .from('projects')
      .update({
        overview_markdown: projectOverview.overview_markdown,
        updated_at: now,
      })
      .eq('id', projectOverview.project_id);

    if (error) {
      throw new Error(`Failed to seed project overview for ${projectOverview.project_id}: ${error.message}`);
    }
  }
}

async function seedTranscripts(fixture: SeedFixture, now: string): Promise<void> {
  const supabase = getSupabase();

  const { error: transcriptError } = await supabase
    .from('transcripts')
    .upsert(
      fixture.transcripts.map((transcript) => ({
        id: transcript.id,
        source_id: transcript.source_id,
        title: transcript.title,
        content: transcript.content,
        summary: transcript.summary,
        date: transcript.date,
        raw_json: transcript.raw_json,
        updated_at: now,
      })),
      { onConflict: 'id' }
    );

  if (transcriptError) {
    throw new Error(`Failed to seed Sprint 4 transcripts: ${transcriptError.message}`);
  }

  const attendeeRows = fixture.transcripts.flatMap((transcript) =>
    transcript.attendees.map((attendee) => ({
      transcript_id: transcript.id,
      email: attendee.email,
      name: attendee.name,
    }))
  );

  if (attendeeRows.length > 0) {
    const { error: attendeeError } = await supabase
      .from('transcript_attendees')
      .upsert(attendeeRows, { onConflict: 'transcript_id,normalized_email' });

    if (attendeeError) {
      throw new Error(`Failed to seed Sprint 4 transcript attendees: ${attendeeError.message}`);
    }
  }

  const classifiedTranscripts = fixture.transcripts.filter((transcript) => transcript.classification !== null);
  const unclassifiedTranscriptIds = fixture.transcripts
    .filter((transcript) => transcript.classification === null)
    .map((transcript) => transcript.id);

  if (classifiedTranscripts.length > 0) {
    const { error: classificationError } = await supabase
      .from('transcript_classification')
      .upsert(
        classifiedTranscripts.map((transcript) => ({
          transcript_id: transcript.id,
          visibility: transcript.classification?.visibility,
          classification_reason: transcript.classification?.classification_reason,
          is_weekly_exception: transcript.classification?.is_weekly_exception,
          normalized_title: transcript.title.trim().toLowerCase(),
          attendee_count: transcript.attendees.length,
          external_attendee_count: transcript.attendees.filter((attendee) => {
            const domain = extractEmailDomain(attendee.email);
            return !domain || !isInternalDomain(domain);
          }).length,
          classified_at: now,
          updated_at: now,
        })),
        { onConflict: 'transcript_id' }
      );

    if (classificationError) {
      throw new Error(`Failed to seed Sprint 4 transcript classifications: ${classificationError.message}`);
    }
  }

  if (unclassifiedTranscriptIds.length > 0) {
    const { error } = await supabase
      .from('transcript_classification')
      .delete()
      .in('transcript_id', unclassifiedTranscriptIds);
    if (error) {
      throw new Error(`Failed to clear Sprint 4 unclassified transcript rows: ${error.message}`);
    }
  }

  const linkedTranscripts = fixture.transcripts.filter((transcript) => transcript.link !== null);
  const unlinkedTranscriptIds = fixture.transcripts
    .filter((transcript) => transcript.link === null)
    .map((transcript) => transcript.id);

  if (linkedTranscripts.length > 0) {
    const { error: linkError } = await supabase
      .from('transcript_project_links')
      .upsert(
        linkedTranscripts.map((transcript) => ({
          transcript_id: transcript.id,
          project_id: transcript.link?.project_id,
          link_source: transcript.link?.link_source,
          updated_at: now,
        })),
        { onConflict: 'transcript_id' }
      );

    if (linkError) {
      throw new Error(`Failed to seed Sprint 4 transcript project links: ${linkError.message}`);
    }
  }

  if (unlinkedTranscriptIds.length > 0) {
    const { error } = await supabase
      .from('transcript_project_links')
      .delete()
      .in('transcript_id', unlinkedTranscriptIds);
    if (error) {
      throw new Error(`Failed to clear Sprint 4 unlinked transcript rows: ${error.message}`);
    }
  }
}

async function main() {
  assertRequiredEnvVars('seed:s4', ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']);
  runSeedS3();

  const fixture = await loadFixture();
  const now = new Date().toISOString();

  await seedProjectOverviews(fixture, now);
  await seedTranscripts(fixture, now);

  console.log('[seed:s4] Seeded Sprint 4 fixture successfully');
}

main().catch((error) => {
  console.error('[seed:s4] Failed:', error);
  process.exitCode = 1;
});
