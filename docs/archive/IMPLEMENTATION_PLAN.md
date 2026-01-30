# OxyChat Enhancement Plan

## Overview

This plan addresses multiple UX/UI improvements and backend architecture changes based on the interview session. The changes span frontend animation systems, backend multi-model support, and interaction design refinements.

---

## 1. Default Model Change

**Current**: `gpt-5-nano` in `backend/app/constants.py`
**Target**: `gpt-5.2`

### Files to modify:
- `backend/app/constants.py` - Change `MODEL` constant
- `frontend/src/components/chat/ModelPicker.tsx` - Update default selection
- `frontend/src/lib/api.ts` - Update default in `streamChat` function

---

## 2. Token Streaming Blur Animation

**Goal**: Smooth blur-in effect on new tokens only (150-250ms timing)

### Approach:
Use [FlowToken](https://github.com/Ephibbs/flowtoken) library - a React component designed specifically for LLM streaming animations.

### Implementation:

1. **Install FlowToken**:
   ```bash
   cd frontend && pnpm add flowtoken
   ```

2. **Create AnimatedText component** (`frontend/src/components/chat/AnimatedText.tsx`):
   - Wrap incoming tokens with FlowToken's `AnimatedMarkdown` component
   - Use `blurIn` animation with `animationDuration="0.2s"` (200ms - middle of 150-250ms range)
   - Disable animation on completed messages (`animation={null}`) to save memory

3. **Modify OxyMessage.tsx**:
   - For streaming messages: use `AnimatedText`
   - For completed messages: render plain text without animation

4. **Update streamChat in api.ts**:
   - Track `isStreaming` state to toggle animation

### CSS additions (globals.css):
```css
/* FlowToken overrides */
.oxy-msg-assistant .flowtoken-container {
  font-size: inherit;
  line-height: inherit;
}
```

---

## 3. User Message Bubble Styling

**Goal**: Right-aligned user messages with gray bubble, AI messages without bubble

### Changes to globals.css:

```css
/* User message bubble */
.oxy-msg-user {
  justify-content: flex-end;
}

.oxy-msg-user .oxy-msg-body {
  background: var(--surface-overlay);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm) var(--spacing-base);
  max-width: 80%;
}

.oxy-msg-user .oxy-msg-text {
  color: var(--text-primary);
}
```

### Changes to OxyMessage.tsx:
- Remove the indicator column for user messages
- Ensure proper right-alignment structure

---

## 4. Fix "Failed to fetch" Error on New Conversation

**Error location**: `src/lib/api.ts:192` in `createConversation`

### Root cause analysis needed:
- CORS issue (unlikely - other endpoints work)
- Network/backend not running
- Content-Type header issue

### Solution:
1. **Add error handling with Sonner toasts**
2. **Install Sonner**:
   ```bash
   cd frontend && pnpm add sonner
   ```

3. **Create toast provider** (`frontend/src/components/providers.tsx`):
   - Add `<Toaster />` component

4. **Update api.ts with retry logic**:
   ```typescript
   async function fetchWithRetry(url: string, options: RequestInit, retries = 3) {
     for (let i = 0; i < retries; i++) {
       try {
         const response = await fetch(url, options);
         if (!response.ok) throw new Error(`HTTP ${response.status}`);
         return response;
       } catch (error) {
         if (i === retries - 1) throw error;
         await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Exponential backoff
       }
     }
   }
   ```

5. **Show toast on error**:
   ```typescript
   import { toast } from 'sonner';
   // In catch block:
   toast.error('Failed to create conversation', { action: { label: 'Retry', onClick: () => createConversation(title) }});
   ```

---

## 5. @ Mention Popover Improvements

**Goals**:
- Faster appearance (snappy)
- Denser layout
- Keyboard navigation (up/down arrows)
- Anchor to @ position
- Direct insert on Enter
- Chip-style mentions (backspace deletes whole ref)

### Files to modify:

1. **OxyMentionPopover.tsx** - Complete rewrite:
   ```typescript
   // Key features:
   // - selectedIndex state for keyboard nav
   // - onKeyDown handler for arrows/enter/escape
   // - Denser padding (8px 12px instead of 10px 14px)
   // - Icon per type (future: folders, skills, agents)
   // - Immediate open (no animation delay)
   ```

2. **OxyComposer.tsx**:
   - Forward keyboard events to popover when open
   - Implement chip rendering for inserted mentions
   - Handle backspace to delete entire chip

3. **New component: MentionChip.tsx**:
   ```typescript
   interface MentionChipProps {
     label: string;
     onRemove: () => void;
   }
   ```

### CSS updates (globals.css):
```css
/* Denser mention popover */
.oxy-mentions {
  padding: 4px;
  animation: none; /* Remove delay */
}

.oxy-mention {
  padding: 8px 12px;
  font-size: var(--font-base);
}

/* Mention chips in composer */
.oxy-mention-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: var(--surface-overlay);
  border-radius: 4px;
  font-size: var(--font-sm);
  color: var(--text-primary);
}
```

---

## 6. Thinking Indicator Redesign

**Goals**:
- Single radiating circle animation (black color from CSS)
- Real-time expandable thinking content
- Contextual labels based on actual operations
- Multiple thinking sections per response possible

### New SSE Event Types (backend changes):

```python
# In chat_service.py, add new event types:
yield f"data: {json.dumps({'type': 'thinking_start', 'label': 'Analyzing question...'})}\n\n"
yield f"data: {json.dumps({'type': 'thinking', 'content': '...'})}\n\n"  # Streamed thinking
yield f"data: {json.dumps({'type': 'thinking_end'})}\n\n"
yield f"data: {json.dumps({'type': 'tool_start', 'tool': 'rag', 'label': 'Searching transcripts...'})}\n\n"
yield f"data: {json.dumps({'type': 'tool_result', 'tool': 'rag', 'sources': [...]})}\n\n"
yield f"data: {json.dumps({'type': 'content', 'content': '...'})}\n\n"
```

### New component: RadiatingIndicator.tsx
```typescript
// Animated SVG with concentric circles
// Black color from --text-primary CSS variable
// Persistent animation while streaming
// Fades out when content arrives
```

### New component: ThinkingSection.tsx
```typescript
interface ThinkingSectionProps {
  label: string;
  content: string;
  isStreaming: boolean;
  defaultExpanded?: boolean;
}
// Collapsible section
// Real-time content updates when expanded
// Click to expand/collapse
```

### CSS for radiating animation:
```css
.oxy-radiate {
  width: 24px;
  height: 24px;
  position: relative;
}

.oxy-radiate-dot {
  width: 6px;
  height: 6px;
  background: var(--text-primary);
  border-radius: 50%;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.oxy-radiate-ring {
  position: absolute;
  inset: 0;
  border: 1px solid var(--text-primary);
  border-radius: 50%;
  opacity: 0;
  animation: radiate 2s ease-out infinite;
}

.oxy-radiate-ring:nth-child(2) { animation-delay: 0.5s; }
.oxy-radiate-ring:nth-child(3) { animation-delay: 1s; }

@keyframes radiate {
  0% { transform: scale(0.5); opacity: 0.6; }
  100% { transform: scale(1.5); opacity: 0; }
}
```

---

## 7. Width Consistency System

**Goal**: Shared responsive CSS variable for chat content width

### CSS updates (globals.css):
```css
:root {
  --chat-content-width: min(800px, 100% - var(--spacing-lg) * 2);
}

@media (min-width: 1200px) {
  :root {
    --chat-content-width: min(900px, 70%);
  }
}

@media (max-width: 768px) {
  :root {
    --chat-content-width: 100%;
  }
}

/* Apply to all chat elements */
.oxy-thread,
.oxy-composer,
.oxy-msg-body,
.oxy-thinking-section {
  max-width: var(--chat-content-width);
  width: 100%;
  margin-left: auto;
  margin-right: auto;
}
```

---

## 8. Clear Input After Send

**File**: `frontend/src/components/chat/OxyComposer.tsx` or parent component

### Fix:
Ensure `onChange("")` is called after successful send in the parent component that manages state.

Check `useConversation.ts` or `page.tsx` for the send handler - it should clear input after calling `streamChat`.

---

## 9. Stop Generating Button

**Goal**: Show stop button during streaming, keep partial response

### Implementation:

1. **Add AbortController to streamChat**:
   ```typescript
   export async function streamChat({
     // ... existing params
     signal?: AbortSignal,
   }) {
     const response = await fetch(url, { ...options, signal });
     // ...
   }
   ```

2. **OxyMessageThread.tsx** - Add stop button:
   ```typescript
   {isStreaming && (
     <button
       className="oxy-stop-btn"
       onClick={onStop}
     >
       Stop generating
     </button>
   )}
   ```

3. **Mark partial responses**:
   Store `isPartial: true` flag on message if stopped early.

---

## 10. Auto-Scroll with "New Messages" Button

**Goal**: Respect user scroll position, show floating button for new content

### Implementation in OxyMessageThread.tsx:

```typescript
const [userScrolledUp, setUserScrolledUp] = useState(false);
const [hasNewContent, setHasNewContent] = useState(false);

// Detect scroll position
const handleScroll = (e) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
  setUserScrolledUp(!isNearBottom);
};

// Show button when streaming and user scrolled up
{userScrolledUp && isStreaming && (
  <button
    className="oxy-scroll-to-new"
    onClick={scrollToBottom}
  >
    <ChevronDown size={16} />
    New content
  </button>
)}
```

### CSS:
```css
.oxy-scroll-to-new {
  position: sticky;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  z-index: 10;
}
```

---

## 11. Backend Multi-Model Architecture

**Goal**: Unified interface for GPT-5.2, Claude, Grok with thinking token support

### Research findings:
- **LiteLLM** provides translation between OpenAI conventions (`reasoning_effort`) and Anthropic's native format
- **LangChain** supports streaming with `stream_mode="messages"`
- Claude thinking mode: `{"thinking": {"type": "enabled", "budget_tokens": 1024}}`
- GPT-5.2 thinking: `reasoning_effort` parameter with values `low`, `medium`, `high`, `xhigh`

### Recommended approach: Interface-first

Create internal interface, implement providers incrementally:

```python
# backend/app/services/model_provider.py
from abc import ABC, abstractmethod
from typing import AsyncIterator

class ModelProvider(ABC):
    @abstractmethod
    async def stream_response(
        self,
        messages: list[dict],
        context: str | None = None,
        thinking_enabled: bool = True,
    ) -> AsyncIterator[StreamEvent]:
        """Yield normalized stream events."""
        pass

class StreamEvent:
    type: str  # 'thinking', 'content', 'tool_call', 'done', 'error'
    content: str | None
    metadata: dict | None


# backend/app/services/providers/openai_provider.py
class OpenAIProvider(ModelProvider):
    async def stream_response(self, messages, context, thinking_enabled):
        response = await self.client.chat.completions.create(
            model="gpt-5.2",
            messages=full_messages,
            stream=True,
            reasoning_effort="medium" if thinking_enabled else None,
        )
        # Normalize to StreamEvent format
        ...


# backend/app/services/providers/anthropic_provider.py
class AnthropicProvider(ModelProvider):
    async def stream_response(self, messages, context, thinking_enabled):
        # Use thinking param for Claude
        thinking_config = {"type": "enabled", "budget_tokens": 4096} if thinking_enabled else None
        ...
```

### Database storage for thinking:
**Recommendation**: Store in `agent_steps` table with `step_type='thinking'`

This aligns with existing schema and allows:
- Linking thinking to specific turns
- Querying thinking content separately
- Future analytics on reasoning patterns

---

## 12. Model Switch Behavior

**Goal**: Prompt user when switching models about history inclusion

### Implementation:

1. **ModelPicker.tsx** - Add confirmation dialog:
   ```typescript
   const [showConfirmDialog, setShowConfirmDialog] = useState(false);
   const [pendingModel, setPendingModel] = useState<ModelOption | null>(null);

   const handleModelSelect = (model: ModelOption) => {
     if (hasExistingMessages && model.id !== currentModel.id) {
       setPendingModel(model);
       setShowConfirmDialog(true);
     } else {
       onModelChange(model);
     }
   };
   ```

2. **Confirmation dialog options**:
   - "Include history" - Send all messages to new model
   - "Fresh start" - Clear context, keep UI messages
   - "Cancel"

---

## Implementation Order

### Phase 1: Quick Wins (Can be done in parallel)
1. Default model change (5 min)
2. Clear input after send (5 min)
3. User message bubble styling (15 min)
4. Width consistency CSS (15 min)

### Phase 2: Core UX (Sequential)
5. Install Sonner + error handling (30 min)
6. Install FlowToken + blur animation (1 hour)
7. Thinking indicator redesign (2 hours)
8. @ mention popover improvements (2 hours)

### Phase 3: Advanced Features
9. Stop generating button (1 hour)
10. Auto-scroll with new messages button (1 hour)
11. Model switch confirmation (1 hour)

### Phase 4: Backend Architecture
12. Multi-model provider interface (2-3 hours)
13. Add Claude provider (1-2 hours)
14. Add Grok provider (1-2 hours)
15. Thinking token storage in agent_steps (1 hour)

---

## Dependencies to Install

```bash
# Frontend
cd frontend
pnpm add flowtoken sonner

# Backend (if using LiteLLM)
cd backend
uv add litellm anthropic
```

---

## Testing Checklist

- [ ] Token blur animation renders smoothly without jank
- [ ] User messages appear right-aligned with bubble
- [ ] AI messages appear left-aligned without bubble
- [ ] @ popover opens instantly on typing @
- [ ] Keyboard navigation works in @ popover
- [ ] Mention chips render correctly
- [ ] Backspace deletes entire chip
- [ ] Radiating animation appears during thinking
- [ ] Thinking section expands/collapses
- [ ] Stop button stops generation and keeps partial
- [ ] Scroll button appears when scrolled up during streaming
- [ ] Error toasts appear with retry option
- [ ] Model switch shows confirmation when history exists
- [ ] Width is consistent across all chat elements

---

## References

- [FlowToken GitHub](https://github.com/Ephibbs/flowtoken) - LLM streaming animations
- [Sonner](https://sonner.emilkowal.ski/) - Toast notifications
- [LiteLLM Anthropic](https://docs.litellm.ai/docs/providers/anthropic) - Multi-model abstraction
- [Anthropic Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents) - Agent patterns
- [OpenAI GPT-5.2 Guide](https://platform.openai.com/docs/models/gpt-5.2) - Reasoning tokens
