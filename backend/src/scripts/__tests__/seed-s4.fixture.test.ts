import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface S4Fixture {
  project_overviews: Array<{ project_id: string; overview_markdown: string | null }>;
  transcripts: Array<{ id: string; source_id: string; link: null | { project_id: string } }>;
}

async function loadFixture(): Promise<S4Fixture> {
  const fixturePath = path.resolve(process.cwd(), 'seeds', 's4.fixture.json');
  const raw = await fs.readFile(fixturePath, 'utf-8');
  return JSON.parse(raw) as S4Fixture;
}

describe('s4 fixture', () => {
  it('has deterministic unique IDs for overviews and transcripts', async () => {
    const fixture = await loadFixture();
    const overviewIds = fixture.project_overviews.map((row) => row.project_id);
    const transcriptIds = fixture.transcripts.map((row) => row.id);
    const sourceIds = fixture.transcripts.map((row) => row.source_id);

    expect(new Set(overviewIds).size).toBe(overviewIds.length);
    expect(new Set(transcriptIds).size).toBe(transcriptIds.length);
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
  });

  it('keeps linked transcript project references explicit', async () => {
    const fixture = await loadFixture();
    const linked = fixture.transcripts.filter((row) => row.link !== null);
    expect(linked.length).toBeGreaterThan(0);
    expect(linked.every((row) => typeof row.link?.project_id === 'string')).toBe(true);
  });
});
