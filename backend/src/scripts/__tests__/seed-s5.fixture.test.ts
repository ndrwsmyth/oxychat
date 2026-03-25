import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface S5Fixture {
  clients: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; client_id: string; name: string }>;
  project_overviews: Array<{ project_id: string; overview_markdown: string | null }>;
  transcripts: Array<{
    id: string;
    source_id: string;
    link: null | { project_id: string; link_source: string };
  }>;
  audit_events: Array<{ id: string; event_type: string }>;
}

async function loadFixture(): Promise<S5Fixture> {
  const fixturePath = path.resolve(process.cwd(), 'seeds', 's5.fixture.json');
  const raw = await fs.readFile(fixturePath, 'utf-8');
  return JSON.parse(raw) as S5Fixture;
}

describe('s5 fixture', () => {
  it('uses deterministic unique transcript IDs and sprint-scoped source IDs', async () => {
    const fixture = await loadFixture();
    const transcriptIds = fixture.transcripts.map((row) => row.id);
    const sourceIds = fixture.transcripts.map((row) => row.source_id);

    expect(new Set(transcriptIds).size).toBe(transcriptIds.length);
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
    expect(sourceIds.every((sourceId) => sourceId.startsWith('fixture:s5:'))).toBe(true);
  });

  it('seeds non-empty client/project/overview datasets for shared environment UX', async () => {
    const fixture = await loadFixture();
    const clientIds = fixture.clients.map((row) => row.id);
    const projectIds = fixture.projects.map((row) => row.id);
    const overviewProjectIds = fixture.project_overviews.map((row) => row.project_id);

    expect(fixture.clients.length).toBeGreaterThan(1);
    expect(fixture.projects.length).toBeGreaterThan(1);
    expect(new Set(clientIds).size).toBe(clientIds.length);
    expect(new Set(projectIds).size).toBe(projectIds.length);
    expect(overviewProjectIds.every((projectId) => projectIds.includes(projectId))).toBe(true);
  });

  it('keeps linked transcript project references explicit and includes admin_manual link source', async () => {
    const fixture = await loadFixture();
    const linked = fixture.transcripts.filter((row) => row.link !== null);

    expect(linked.length).toBeGreaterThan(0);
    expect(linked.every((row) => typeof row.link?.project_id === 'string')).toBe(true);
    expect(linked.some((row) => row.link?.link_source === 'admin_manual')).toBe(true);
  });

  it('includes non-benchmark audit timeline fixtures with preserved routing event type', async () => {
    const fixture = await loadFixture();
    const eventIds = fixture.audit_events.map((row) => row.id);

    expect(fixture.audit_events.length).toBeGreaterThan(0);
    expect(new Set(eventIds).size).toBe(eventIds.length);
    expect(fixture.audit_events.some((row) => row.event_type === 'transcript.routed.preserved')).toBe(
      true
    );
    expect(fixture.audit_events.some((row) => row.event_type.startsWith('bench.'))).toBe(false);
  });
});
