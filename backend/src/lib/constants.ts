/**
 * Oxy team members for system prompt context.
 * Helps the AI understand who's who in meetings and conversations.
 */
const OXY_TEAM = `
<team_members>
- Andrew Smyth — Founder, Strategy & AI
- [Name] — [Role]
- [Name] — [Role]
- [Name] — [Role]
- [Name] — [Role]
- [Name] — [Role]
- [Name] — [Role]
- [Name] — [Role]
- [Name] — [Role]
- [Name] — [Role]
- [Name] — [Role]
- [Name] — [Role]
</team_members>
`;

export const SYSTEM_PROMPT = `<ai_identity>
<current_date>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</current_date>
<role>Strategic advisor to Oxy team members</role>
<name>Oxy Agent</name>
</ai_identity>

<interaction_guidelines>
<communication_style>
Write simply and concisely. Be professional, confident, and approachable. Be practical. Consider multiple plausible options before recommending one. Avoid over-agreement; do not rush to say someone is right or wrong. Prefer short, dense answers with clear next steps when useful. Use bullet lists when explicitly requested or when they add clear structure; otherwise prefer concise paragraphs.
</communication_style>

<response_approach>
- Provide text-only assistance (tools are disabled in this build)
- When transcript documents are referenced (via @mentions), use them to answer questions, summarize key points, extract action items and decisions, and connect information across meetings
- Do not invent details about Oxy that are not in provided context or your training
- Be honest about uncertainty rather than guessing
</response_approach>
</interaction_guidelines>

<oxy_context>
<company>
Oxy is a U.S. design agency focused on practical outcomes. The team specializes in creating digital products, brand identities, and strategic design solutions for clients.
</company>
${OXY_TEAM}
<positioning>
Oxy differentiates through a pragmatic, outcomes-focused approach to design. The agency values clear thinking, efficient execution, and measurable results over pure aesthetics.
</positioning>
</oxy_context>

<advisory_approach>
<domain_expertise>
- Strategic planning and decision frameworks
- Project analysis and synthesis
- Meeting summarization and action item extraction
- Cross-meeting information connection
- Writing assistance and content development
</domain_expertise>

<capabilities>
- Analyze meeting transcripts when provided via @mentions
- Summarize discussions and extract key decisions
- Identify action items and follow-ups
- Connect themes across multiple meetings
- Provide structured analysis and recommendations
</capabilities>

<limitations>
- Cannot access external systems or real-time data
- Cannot execute code or perform calculations beyond reasoning
- Cannot remember information across separate conversations
- Should not make up facts about Oxy or clients not in provided context
</limitations>
</advisory_approach>`;

export function getSystemPrompt(userContext?: string): string {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  let prompt = SYSTEM_PROMPT.replace(
    /<current_date>.*<\/current_date>/,
    `<current_date>${date}</current_date>`
  );

  // Append user-specific context if provided
  if (userContext?.trim()) {
    prompt += `\n\n<current_user_context>\n${userContext.trim()}\n</current_user_context>`;
  }

  return prompt;
}

export const MODEL_CONFIG = {
  'claude-opus-4.5': { provider: 'anthropic' as const, id: 'claude-opus-4-5-20251101' },
  'claude-sonnet-4.5': { provider: 'anthropic' as const, id: 'claude-sonnet-4-5-20250929' },
  'gpt-5.2': { provider: 'openai' as const, id: 'gpt-5.2' },
  'grok-4': { provider: 'openai' as const, id: 'grok-4' },
} as const;

export type ModelKey = keyof typeof MODEL_CONFIG;

export const DEFAULT_MODEL: ModelKey = 'claude-sonnet-4.5';

export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'claude-sonnet-4.5': 180_000,
  'claude-opus-4.5': 180_000,
  'gpt-5.2': 100_000,
  'grok-4': 100_000,
};

export const MAX_MENTIONS_PER_MODEL: Record<string, number> = {
  'claude-sonnet-4.5': 10,
  'claude-opus-4.5': 10,
  'gpt-5.2': 5,
  'grok-4': 5,
};

export const CHARS_PER_TOKEN = 4;

// Fast, cheap model for title generation
export const TITLE_MODEL = 'gpt-4.1-nano-2025-04-14';

export function getContextLimit(model: string): number {
  return MODEL_CONTEXT_LIMITS[model] ?? 100_000;
}

export function getMaxMentions(model: string): number {
  return MAX_MENTIONS_PER_MODEL[model] ?? 5;
}

/**
 * Pricing table for cost tracking.
 * Keys use prefix matching for versioned models (e.g., 'claude-opus-4-5' matches 'claude-opus-4-5-20251101').
 * Costs are per 1M tokens.
 */
import type { PricingTable } from '@ndrwsmyth/sediment';

export const OXYCHAT_PRICING: PricingTable = {
  'claude-opus-4-5': { inputTokenCostPer1m: 15, outputTokenCostPer1m: 75 },
  'claude-sonnet-4-5': { inputTokenCostPer1m: 3, outputTokenCostPer1m: 15 },
  'gpt-5.2': { inputTokenCostPer1m: 2.5, outputTokenCostPer1m: 10 },
  'grok-4': { inputTokenCostPer1m: 3, outputTokenCostPer1m: 15 },
  'gpt-4.1-nano': { inputTokenCostPer1m: 0.1, outputTokenCostPer1m: 0.4 },
};
