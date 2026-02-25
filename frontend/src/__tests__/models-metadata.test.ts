import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useConversation } from '../hooks/useConversation';
import { fetchConversationWithMessages, fetchModels, streamChat } from '../lib/api';

vi.mock('../lib/api', () => ({
  fetchConversationWithMessages: vi.fn(),
  fetchModels: vi.fn(),
  streamChat: vi.fn(),
}));

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function createModelsResponse() {
  return {
    defaultModel: 'claude-sonnet-4-6',
    models: [
      { key: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', provider: 'anthropic' },
      { key: 'claude-opus-4-6', label: 'Claude Opus 4.6', provider: 'anthropic' },
      { key: 'gpt-5.2', label: 'GPT-5.2', provider: 'openai' },
      { key: 'grok-4', label: 'Grok 4', provider: 'openai' },
    ],
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function HookHarness({
  onChange,
}: {
  onChange: (value: ReturnType<typeof useConversation>) => void;
}) {
  const value = useConversation(null);
  useEffect(() => {
    onChange(value);
  }, [onChange, value]);
  return null;
}

describe('useConversation model metadata behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(fetchConversationWithMessages).mockResolvedValue({
      messages: [],
      projectId: null,
    });
    vi.mocked(streamChat).mockResolvedValue();
    vi.mocked(fetchModels).mockResolvedValue(createModelsResponse());
  });

  it('loads picker options and default model from /api/models', async () => {
    let latest: ReturnType<typeof useConversation> | null = null;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(createElement(HookHarness, { onChange: (value) => { latest = value; } }));
      await flush();
    });

    expect(latest?.isModelsReady).toBe(true);
    expect(latest?.model).toBe('claude-sonnet-4-6');
    expect(latest?.modelOptions.map((option) => option.value)).toEqual([
      'claude-sonnet-4-6',
      'claude-opus-4-6',
      'gpt-5.2',
      'grok-4',
    ]);

    await act(async () => {
      root.unmount();
    });
  });

  it('auto-upgrades legacy localStorage model values to 4.6 IDs', async () => {
    localStorage.setItem('oxy-chat-model', 'claude-opus-4.5');

    let latest: ReturnType<typeof useConversation> | null = null;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(createElement(HookHarness, { onChange: (value) => { latest = value; } }));
      await flush();
    });

    expect(latest?.model).toBe('claude-opus-4-6');
    expect(localStorage.getItem('oxy-chat-model')).toBe('claude-opus-4-6');

    await act(async () => {
      root.unmount();
    });
  });

  it('falls back to backend default when stored value is unknown', async () => {
    localStorage.setItem('oxy-chat-model', 'unknown-model');

    let latest: ReturnType<typeof useConversation> | null = null;

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(createElement(HookHarness, { onChange: (value) => { latest = value; } }));
      await flush();
    });

    expect(latest?.model).toBe('claude-sonnet-4-6');

    await act(async () => {
      root.unmount();
    });
  });
});
