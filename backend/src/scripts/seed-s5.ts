import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getSupabase } from "../lib/supabase.js";
import { extractEmailDomain, isInternalDomain } from "../lib/transcript-normalization.js";
import { assertRequiredEnvVars } from "./lib/preflight.js";

interface ClientFixture {
  id: string;
  name: string;
  scope: "personal" | "client" | "global";
}

interface ProjectFixture {
  id: string;
  client_id: string;
  name: string;
  scope: "personal" | "client" | "global";
  is_inbox: boolean;
}

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
    visibility: "private" | "non_private";
    classification_reason:
      | "weekly_exception"
      | "external_attendee"
      | "internal_attendees_only"
      | "no_attendees";
    is_weekly_exception: boolean;
  };
  link: null | {
    project_id: string;
    link_source:
      | "domain_match"
      | "title_alias"
      | "client_inbox_fallback"
      | "global_triage_fallback"
      | "admin_manual";
  };
}

interface AuditEventFixture {
  id: string;
  actor_user_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  request_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

interface SeedFixture {
  clients: ClientFixture[];
  projects: ProjectFixture[];
  project_overviews: ProjectOverviewFixture[];
  transcripts: TranscriptFixture[];
  audit_events: AuditEventFixture[];
}

function runSeedS4(): void {
  const result = spawnSync("pnpm", ["run", "seed:s4"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error("seed:s4 failed");
  }
}

async function loadFixture(): Promise<SeedFixture> {
  const fixturePath = path.resolve(process.cwd(), "seeds", "s5.fixture.json");
  const raw = await fs.readFile(fixturePath, "utf-8");
  return JSON.parse(raw) as SeedFixture;
}

async function seedClientsAndProjects(fixture: SeedFixture, now: string): Promise<void> {
  const supabase = getSupabase();

  if (fixture.clients.length > 0) {
    const { error } = await supabase
      .from("clients")
      .upsert(
        fixture.clients.map((client) => ({
          ...client,
          updated_at: now,
        })),
        { onConflict: "id" }
      );

    if (error) {
      throw new Error(`Failed to seed Sprint 5 clients: ${error.message}`);
    }
  }

  if (fixture.projects.length > 0) {
    const { error } = await supabase
      .from("projects")
      .upsert(
        fixture.projects.map((project) => ({
          ...project,
          updated_at: now,
        })),
        { onConflict: "id" }
      );

    if (error) {
      throw new Error(`Failed to seed Sprint 5 projects: ${error.message}`);
    }
  }

  for (const projectOverview of fixture.project_overviews) {
    const { error } = await supabase
      .from("projects")
      .update({
        overview_markdown: projectOverview.overview_markdown,
        updated_at: now,
      })
      .eq("id", projectOverview.project_id);

    if (error) {
      throw new Error(
        `Failed to seed Sprint 5 project overview for ${projectOverview.project_id}: ${error.message}`
      );
    }
  }
}

async function seedTranscripts(fixture: SeedFixture, now: string): Promise<void> {
  const supabase = getSupabase();

  const { error: transcriptError } = await supabase
    .from("transcripts")
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
      { onConflict: "id" }
    );

  if (transcriptError) {
    throw new Error(`Failed to seed Sprint 5 transcripts: ${transcriptError.message}`);
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
      .from("transcript_attendees")
      .upsert(attendeeRows, { onConflict: "transcript_id,normalized_email" });

    if (attendeeError) {
      throw new Error(`Failed to seed Sprint 5 transcript attendees: ${attendeeError.message}`);
    }
  }

  const classifiedTranscripts = fixture.transcripts.filter((transcript) => transcript.classification !== null);
  const unclassifiedTranscriptIds = fixture.transcripts
    .filter((transcript) => transcript.classification === null)
    .map((transcript) => transcript.id);

  if (classifiedTranscripts.length > 0) {
    const { error: classificationError } = await supabase
      .from("transcript_classification")
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
        { onConflict: "transcript_id" }
      );

    if (classificationError) {
      throw new Error(`Failed to seed Sprint 5 transcript classifications: ${classificationError.message}`);
    }
  }

  if (unclassifiedTranscriptIds.length > 0) {
    const { error } = await supabase
      .from("transcript_classification")
      .delete()
      .in("transcript_id", unclassifiedTranscriptIds);
    if (error) {
      throw new Error(`Failed to clear Sprint 5 unclassified transcript rows: ${error.message}`);
    }
  }

  const linkedTranscripts = fixture.transcripts.filter((transcript) => transcript.link !== null);
  const unlinkedTranscriptIds = fixture.transcripts
    .filter((transcript) => transcript.link === null)
    .map((transcript) => transcript.id);

  if (linkedTranscripts.length > 0) {
    const { error: linkError } = await supabase
      .from("transcript_project_links")
      .upsert(
        linkedTranscripts.map((transcript) => ({
          transcript_id: transcript.id,
          project_id: transcript.link?.project_id,
          link_source: transcript.link?.link_source,
          updated_at: now,
        })),
        { onConflict: "transcript_id" }
      );

    if (linkError) {
      throw new Error(`Failed to seed Sprint 5 transcript links: ${linkError.message}`);
    }
  }

  if (unlinkedTranscriptIds.length > 0) {
    const { error } = await supabase
      .from("transcript_project_links")
      .delete()
      .in("transcript_id", unlinkedTranscriptIds);
    if (error) {
      throw new Error(`Failed to clear Sprint 5 unlinked transcript rows: ${error.message}`);
    }
  }
}

async function seedAuditEvents(fixture: SeedFixture): Promise<void> {
  const supabase = getSupabase();
  if (fixture.audit_events.length === 0) return;

  const ids = fixture.audit_events.map((event) => event.id);
  const { data: existingRows, error: existingError } = await supabase
    .from("audit_events")
    .select("id")
    .in("id", ids);

  if (existingError) {
    throw new Error(`Failed to inspect existing Sprint 5 audit events: ${existingError.message}`);
  }

  const existingIds = new Set((existingRows ?? []).map((row) => row.id as string));
  const missingEvents = fixture.audit_events.filter((event) => !existingIds.has(event.id));

  if (missingEvents.length === 0) return;

  const { error: insertError } = await supabase
    .from("audit_events")
    .insert(
      missingEvents.map((event) => ({
        id: event.id,
        actor_user_id: event.actor_user_id,
        event_type: event.event_type,
        entity_type: event.entity_type,
        entity_id: event.entity_id,
        request_id: event.request_id,
        payload: event.payload,
        created_at: event.created_at,
      }))
    );

  if (insertError) {
    throw new Error(`Failed to seed Sprint 5 audit events: ${insertError.message}`);
  }
}

async function main() {
  assertRequiredEnvVars("seed:s5", ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"]);
  runSeedS4();

  const fixture = await loadFixture();
  const now = new Date().toISOString();
  await seedClientsAndProjects(fixture, now);
  await seedTranscripts(fixture, now);
  await seedAuditEvents(fixture);

  console.log("[seed:s5] Seeded Sprint 5 fixture successfully");
}

main().catch((error) => {
  console.error("[seed:s5] Failed:", error);
  process.exitCode = 1;
});
