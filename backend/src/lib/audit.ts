import { getSupabase } from './supabase.js';

export interface AuditEventInput {
  actorUserId: string | null;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  payload?: Record<string, unknown>;
  requestId?: string | null;
}

export async function writeAuditEvent(input: AuditEventInput): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('audit_events').insert({
    actor_user_id: input.actorUserId,
    event_type: input.eventType,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    request_id: input.requestId ?? null,
    payload: input.payload ?? {},
  });

  if (error) {
    console.error('[audit] Failed to write event:', error.message);
  }
}
