import type {
  Logger,
  CompletionRecordInterface,
  ToolRecordInterface,
  CompletionRecord,
  ToolRecord,
} from '@ndrwsmyth/sediment';
import { getSupabase } from '../lib/supabase.js';

/**
 * Sediment Logger implementation that writes CompletionRecords to Supabase.
 * Fire-and-forget inserts with error logging.
 */
export class SupabaseLogStore implements Logger {
  private records: CompletionRecord[] = [];
  private toolRecords: ToolRecord[] = [];

  log(record: CompletionRecordInterface): void {
    this.records.push(record as CompletionRecord);

    const supabase = getSupabase();
    supabase
      .from('completion_logs')
      .insert({
        completion_id: record.id,
        context_id: record.context?.contextId,
        request_id: record.requestId,
        product_name: record.context?.productName,
        product_step: record.context?.productStep,
        model: record.params?.model,
        params: record.params as Record<string, unknown>,
        completion: record.response as Record<string, unknown>,
        timing: record.timing as Record<string, unknown> | undefined,
        tokens: record.response?.usage as Record<string, unknown> | undefined,
        cost: record.cost as Record<string, unknown> | undefined,
        error: record.error ? { message: record.error } : undefined,
      })
      .then(({ error }) => {
        if (error) console.error('[SupabaseLogStore] insert error:', error.message);
      });
  }

  getRecords(): CompletionRecord[] {
    return this.records;
  }

  getByRequestId(requestId: string): CompletionRecord[] {
    return this.records.filter((r) => r.requestId === requestId);
  }

  logTool(record: ToolRecordInterface): void {
    this.toolRecords.push(record as ToolRecord);
  }

  getToolRecords(): ToolRecord[] {
    return this.toolRecords;
  }

  getToolRecordsByRequestId(requestId: string): ToolRecord[] {
    return this.toolRecords.filter((r) => r.requestId === requestId);
  }

  clear(): void {
    this.records = [];
    this.toolRecords = [];
  }
}
