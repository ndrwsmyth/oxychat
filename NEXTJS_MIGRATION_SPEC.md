# OxyChat Next.js Migration & UI Redesign Spec

## Overview

Migrate OxyChat frontend from Vite to Next.js App Router and redesign UI based on OxyChatRedesign_4.jsx - a minimal, centered, drawer-based chat interface.

---

## Architecture Decisions

| Decision | Choice |
|----------|--------|
| Backend | Keep Python/FastAPI separate (no migration) |
| Frontend | Next.js App Router (replace /frontend) |
| Streaming | Keep custom SSE (not Vercel AI SDK) |
| Components | shadcn/ui restyled to match v4 aesthetic |
| Deployment | Backend → Railway/Render, Frontend → Vercel |
| Repo | Monorepo (replace /frontend with Next.js) |

---

## Design Specifications

### Core Aesthetic
Based on `/frontend_examples/OxyChatRedesign_4.jsx`:

- **Layout**: Centered single-column, 720px max-width, always centered (even on wide screens)
- **Color**: Pure monochrome - black (#121212), white (#fefefe), grays. No accent colors.
- **Typography**: Inter font, -webkit-font-smoothing: antialiased
- **Theme**: Light + Dark mode (system preference + manual toggle)

### Color System
```css
/* Light theme */
--black: #121212;
--gray-900: #1a1a1a;
--gray-800: #2e2e2e;
--gray-700: #4a4a4a;
--gray-600: #6a6a6a;
--gray-500: #8a8a8a;
--gray-400: #a3a3a3;
--gray-300: #c2c2c2;
--gray-200: #e0e0e0;
--gray-100: #f0f0f0;
--gray-50: #f8f8f7;
--white: #fefefe;

/* Semantic */
--text-primary: var(--gray-900);
--text-secondary: var(--gray-600);
--text-tertiary: var(--gray-500);
--text-faint: var(--gray-400);

--surface: var(--white);
--surface-raised: var(--white);
--surface-overlay: var(--gray-50);

--border: rgba(0,0,0,0.06);
--border-strong: rgba(0,0,0,0.1);

--focus: rgba(0,0,0,0.85);
--focus-ring: rgba(0,0,0,0.08);
```

### Components

| Component | Behavior |
|-----------|----------|
| Header | Minimal - logo (concentric circles + "Oxy") on left, library icon button on right |
| Library | Slide-in drawer from right (not sidebar). Click transcript → insert @mention |
| Empty state | "Good [morning/afternoon/evening]" + title + description + 3 starter prompts |
| Messages | User messages right-aligned (gray text), assistant left with dot indicator |
| Timestamps | Show only on hover |
| Input | Auto-resize textarea, 300px max then scroll, rounded container |
| Loading | Simple "Searching transcripts..." with animated ellipsis |
| Mentions | Popover above input when @ typed |

### Interactions
- **Send message**: Optimistic (appears immediately)
- **Transcript click**: Inserts @mention into input
- **Date format**: Relative (<7 days: "3 days ago"), then date ("Dec 28")
- **Focus states**: Use box-shadow focus rings (rgba(0,0,0,0.08))

---

## Implementation Steps

### Step 1: Initialize Next.js Project
- Delete current `/frontend` directory
- Create new Next.js 14+ App Router project in `/frontend`
- Configure: TypeScript, Tailwind, App Router, src/ directory
- Set up path aliases (@/)

### Step 2: Install & Configure Dependencies
```bash
pnpm add class-variance-authority clsx tailwind-merge lucide-react
pnpm add @radix-ui/react-scroll-area @radix-ui/react-dialog @radix-ui/react-popover
pnpm add next-themes
```

### Step 3: Set Up Theme System
- Create CSS variables for light/dark modes
- Add ThemeProvider (next-themes)
- System preference detection + manual toggle
- Store preference in localStorage

### Step 4: Create Base shadcn Components (Restyled)
Restyle to match v4's minimal aesthetic:
- Button (ghost variants, focus rings)
- Input/Textarea (clean borders, focus states)
- ScrollArea
- Dialog (for potential future use)
- Popover (for @mentions)

### Step 5: Build Core Layout
- `app/layout.tsx`: ThemeProvider, Inter font, base styles
- `app/page.tsx`: Main chat interface
- Centered container (max-w-2xl mx-auto)
- Header component (logo + library button)
- Subtle ambient gradient background

### Step 6: Build Chat Components
- `ChatPage`: Main container with empty state / thread toggle
- `EmptyState`: Greeting, title, description, starter prompts
- `MessageThread`: Scrollable message list
- `Message`: User vs assistant styling, hover timestamps
- `ThinkingIndicator`: Dot + "Searching transcripts..."
- `ChatInput`: Auto-resize textarea, send button, @hint

### Step 7: Build Library Drawer
- Slide-in drawer (right side)
- Transcript list (title + relative date)
- Click to insert @mention
- Search input (filter transcripts)

### Step 8: Build @Mention System
- Detect @ in input
- Show popover with filtered transcripts
- Select to insert `@TranscriptTitle`
- Parse mentions when sending

### Step 9: Implement Hooks (Fresh)
- `useChat`: Messages state, send, SSE streaming
- `useTranscripts`: Fetch, search, CRUD
- `useTheme`: Theme toggle, system preference

### Step 10: API Integration
- Create API client (`lib/api.ts`)
- SSE streaming handler
- Proxy config or direct backend URL
- Environment variables

### Step 11: Mobile Responsiveness
- Desktop-first, basic mobile support
- Responsive padding/margins
- Touch-friendly tap targets
- Drawer works on mobile

### Step 12: Polish & Animation
- Subtle fade animations (fadeUp)
- Message entrance animations
- Drawer slide transition
- Focus ring transitions

---

## File Structure

```
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/           # Restyled shadcn
│   ├── chat/
│   │   ├── ChatPage.tsx
│   │   ├── EmptyState.tsx
│   │   ├── MessageThread.tsx
│   │   ├── Message.tsx
│   │   ├── ChatInput.tsx
│   │   └── ThinkingIndicator.tsx
│   ├── library/
│   │   ├── LibraryDrawer.tsx
│   │   └── TranscriptCard.tsx
│   ├── mentions/
│   │   └── MentionPopover.tsx
│   ├── Header.tsx
│   └── ThemeToggle.tsx
├── hooks/
│   ├── useChat.ts
│   ├── useTranscripts.ts
│   └── useTheme.ts
├── lib/
│   ├── api.ts
│   └── utils.ts
├── types/
│   └── index.ts
└── package.json
```

---

## Backend Changes
None required. Existing FastAPI endpoints work as-is:
- `GET /api/transcripts`
- `POST /api/chat/stream` (SSE)
- `POST /api/transcripts/search`

---

## Deployment

### Backend (Railway/Render/Fly)
- Deploy FastAPI as-is
- Set environment variables
- Note public URL

### Frontend (Vercel)
- Connect to GitHub repo
- Set `NEXT_PUBLIC_API_URL` environment variable
- Deploy from /frontend directory

---

## Reference Files

- Design reference: `/frontend_examples/OxyChatRedesign_4.jsx`
- Current backend API: `/backend/app/routers/chat.py`, `/backend/app/routers/transcripts.py`
