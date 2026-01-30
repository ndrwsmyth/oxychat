/**
 * Standard interface for transcript sources.
 * Extractable to Sediment core for reuse across Oxy products.
 */
export interface NormalizedTranscript {
  sourceId: string;
  title: string;
  content: string;
  summary: string | null;
  date: Date;
  rawJson: unknown;
}

export interface TranscriptSource<T = unknown> {
  readonly sourceName: string;
  transform(payload: T): NormalizedTranscript;
}

// Circleback-specific types
export interface CirclebackPayload {
  id: number;
  name: string;
  createdAt: string;
  duration: number;
  attendees: Array<{ name: string; email: string }>;
  transcript: Array<{ speaker: string; text: string; timestamp: number }>;
  notes?: string;
  actionItems?: Array<{
    title: string;
    description: string;
    assignee?: { name: string };
  }>;
}

export function createCirclebackSource(): TranscriptSource<CirclebackPayload> {
  return {
    sourceName: 'circleback',
    transform(payload) {
      const dateStr = formatDate(payload.createdAt);
      const durationStr = formatMinutesSeconds(payload.duration);
      const people = payload.attendees.map((a) => a.name).join(', ');

      const body = payload.transcript
        .map((t) => `[${formatMinutesSeconds(t.timestamp)}] ${t.speaker}: ${t.text}`)
        .join('\n');

      const content = `# ${payload.name}
Date: ${dateStr}
Duration: ${durationStr}
People: ${people}

${body}`;

      return {
        sourceId: `circleback:${payload.id}`,
        title: payload.name,
        content,
        summary: payload.notes ?? null,
        date: new Date(payload.createdAt),
        rawJson: payload,
      };
    },
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatMinutesSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
