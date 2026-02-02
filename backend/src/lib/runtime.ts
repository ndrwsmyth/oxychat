import {
  createAnthropicAdapter,
  createOpenAIAdapter,
  Runtime,
  CompositeLogger,
  ConsoleLogger,
} from 'sediment';
import type { CompletionsAdapterInterface } from 'sediment';
import { MODEL_CONFIG, type ModelKey } from './constants.js';
import { SupabaseLogStore } from '../adapters/supabase-log-store.js';

// Singleton adapters
let anthropicAdapter: CompletionsAdapterInterface | null = null;
let openaiAdapter: CompletionsAdapterInterface | null = null;

function getAnthropicAdapter(): CompletionsAdapterInterface {
  if (!anthropicAdapter) {
    anthropicAdapter = createAnthropicAdapter({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      maxRetries: 3,
    });
  }
  return anthropicAdapter;
}

function getOpenAIAdapter(): CompletionsAdapterInterface {
  if (!openaiAdapter) {
    openaiAdapter = createOpenAIAdapter({
      apiKey: process.env.OPENAI_API_KEY!,
      maxRetries: 3,
    });
  }
  return openaiAdapter;
}

export function getAdapterForModel(model: string): CompletionsAdapterInterface {
  const config = MODEL_CONFIG[model as ModelKey];
  if (!config) throw new Error(`Unknown model: ${model}`);
  return config.provider === 'anthropic' ? getAnthropicAdapter() : getOpenAIAdapter();
}

export function getModelId(model: string): string {
  const config = MODEL_CONFIG[model as ModelKey];
  if (!config) throw new Error(`Unknown model: ${model}`);
  return config.id;
}

const supabaseLogStore = new SupabaseLogStore();

function createLogger(): CompositeLogger {
  return new CompositeLogger([new ConsoleLogger(), supabaseLogStore]);
}

export function createChatRuntime(opts: {
  model: string;
  conversationId: string;
}): ReturnType<typeof Runtime.create> {
  return Runtime.create({
    completions: getAdapterForModel(opts.model),
    logger: createLogger(),
    productName: 'oxychat',
    productStep: 'chat_pipeline',
    requestId: crypto.randomUUID(),
  });
}

export function createIngestRuntime(): ReturnType<typeof Runtime.create> {
  return Runtime.create({
    completions: getOpenAIAdapter(),
    logger: createLogger(),
    productName: 'oxychat',
    productStep: 'transcript_ingestion',
    requestId: crypto.randomUUID(),
  });
}

/**
 * Creates a dedicated runtime for title generation.
 * Uses OpenAI adapter for the nano model (fast, cheap).
 */
export function createTitleRuntime(): ReturnType<typeof Runtime.create> {
  return Runtime.create({
    completions: getOpenAIAdapter(),
    logger: createLogger(),
    productName: 'oxychat',
    productStep: 'title_generation',
    requestId: crypto.randomUUID(),
  });
}
